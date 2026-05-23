import requests
import json
import pymysql
from datetime import datetime

CLIENT_ID = "b1329023-4b484569-b70c-4511"
CLIENT_SECRET = "fffcfb8e-7380-47af-9963-b99ac5b4ef9e"

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'parking',
    'charset': 'utf8mb4'
}

TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
URL_GEO = "https://tdx.transportdata.tw/api/basic/v1/Parking/OnStreet/ParkingSegment/City/Taipei?%24format=JSON"
URL_SPACE = "https://tdx.transportdata.tw/api/basic/v1/Parking/OnStreet/ParkingSegmentSpace/City/Taipei?%24format=JSON"

def get_token():
    payload = {'grant_type': 'client_credentials', 'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET}
    res = requests.post(TOKEN_URL, data=payload, headers={'content-type': 'application/x-www-form-urlencoded'}, timeout=10)
    return res.json().get('access_token') if res.status_code == 200 else None

def fetch_data(url, token):
    headers = {'Authorization': f'Bearer {token}', 'Accept-Encoding': 'gzip'}
    res = requests.get(url, headers=headers, timeout=20)
    return res.json() if res.status_code == 200 else None

def main():
    token = get_token()
    if not token: return

    print("📥 下載路段地理位置...")
    raw_geo = fetch_data(URL_GEO, token)
    print("📥 下載車位詳細配置...")
    raw_space = fetch_data(URL_SPACE, token)

    if not raw_geo or not raw_space: return

    # 建立位置對照雜湊表
    geo_dict = {}
    for item in raw_geo.get('ParkingSegments', []):
        seg_id = item.get('ParkingSegmentID')
        if seg_id:
            geo_dict[seg_id] = {
                'name': item.get('ParkingSegmentName', {}).get('Zh_tw', '未知路段'),
                'town': item.get('TownName', '未知區域'),
                'lat': item.get('ParkingSegmentPosition', {}).get('PositionLat', 0.0),
                'lon': item.get('ParkingSegmentPosition', {}).get('PositionLon', 0.0),
                'geo': item.get('Geometry', '找不到地理位置資訊'),
                'fare': item.get('FareDescription', '無費率資訊')
            }

    final_rows = []
    # 解析格位配置並分類
    for seg in raw_space.get('CurbSegmentParkingSpaces', []):
        seg_id = seg.get('ParkingSegmentID')
        
        if seg_id in geo_dict:
            # 預設三種車位總數皆為 0
            t_general = 0
            t_handicap = 0
            t_pregnancy = 0
            
            # 巡迴 Spaces 陣列累加
            for space in seg.get('Spaces', []):
                stype = str(space.get('SpaceType'))
                count = space.get('NumberOfSpaces', 0)
                
                if stype == '1':
                    t_general = count
                elif stype == '2':
                    t_handicap = count
                elif stype == '3':
                    t_pregnancy = count
            
            # 🚀 只要有其中一種汽車位存在，就收錄進資料庫
            if t_general > 0 or t_handicap > 0 or t_pregnancy > 0:
                geo = geo_dict[seg_id]
                row = (
                    seg_id,
                    geo['town'],
                    geo['name'],
                    geo['lat'],
                    geo['lon'],
                    geo['geo'],
                    t_general,
                    t_handicap,
                    t_pregnancy,
                    geo['fare']
                )
                final_rows.append(row)

    print(f"📊 過濾重組完成！共 {len(final_rows)} 條有效汽車路段。正在寫入資料庫...")
    
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    sql = """
        INSERT INTO road_side (
            road_id, area_id, road_name, latitude, longitude, geometry_wkt,
            total_car, total_handicap, total_pregnancy, charge
        ) VALUES (
            %s, 
            COALESCE((SELECT area_id FROM area WHERE area_name = %s LIMIT 1), '200'), 
            %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON DUPLICATE KEY UPDATE 
            area_id = VALUES(area_id),
            road_name = VALUES(road_name),
            latitude = VALUES(latitude),
            longitude = VALUES(longitude),
            geometry_wkt = VALUES(geometry_wkt),
            total_car = VALUES(total_car),
            total_handicap = VALUES(total_handicap),
            total_pregnancy = VALUES(total_pregnancy),
            charge = VALUES(charge);
    """
    sql_status = """
        INSERT INTO road_side_status (road_id) 
        VALUES (%s)
        ON DUPLICATE KEY UPDATE road_id = road_id;
    """
    try:
        cursor.executemany(sql, final_rows)
        inserted_main = cursor.rowcount
        cursor.executemany(sql_status, [(row[0],) for row in final_rows])
        inserted_status = cursor.rowcount
        conn.commit()
        print(f"🎉 3合1 靜態打底成功！主表影響 {inserted_main} 筆，狀態表初始化 {inserted_status} 筆。")
    except Exception as e:
        conn.rollback()
        print(f"❌ 寫入失敗，原因如下：")
        print(e)  # 🎯 關鍵！讓 Python 把真正做錯的事印在終端機上
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()