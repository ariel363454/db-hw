import requests
import pymysql
import logging
import re
from pyproj import Transformer

# ==========================================
# 1. 配置區域 (Configuration)
# 將變動因素抽離，方便管理
# ==========================================
transformer = Transformer.from_crs("epsg:3826", "epsg:4326", always_xy=True)
API_URL = "https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json"
#API_KEY = "你的 API KEY"  # 如果有的話

DB_CONFIG = {
    "host": "127.0.0.1",
    "user": "root",
    "password": "", 
    "database": "parking",
    "charset": "utf8mb4"
}

# ==========================================
# 2. 邏輯函數區域 (Functions)
# ==========================================

def fetch_opendata():
    """負責從網路抓取原始資料"""
    print("停車場靜態資料抓取中...")
    response = requests.get(API_URL)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"抓取失敗，錯誤代碼：{response.status_code}")
        return None

def transform_data(raw_json):
    """負責處理 JSON，過濾出你要的欄位"""
    print("資料過濾轉換中...")
    processed_list = [] 
    parks = raw_json.get('data', {}).get('park', [])
    
    for item in parks:
        lot_id = str(item.get('id', ''))
        if not lot_id.startswith('TPE'):
            print(f"偵測到異常 ID 格式: {lot_id} ({item.get('name')})，已自動過濾丟棄。")
            continue
        try:
            x = float(item.get('tw97x', 0))
            y = float(item.get('tw97y', 0))
            if x != 0 and y != 0:
                lon, lat = transformer.transform(x, y)
            else:
                lat, lon = 0, 0
        except Exception as e:
            lat, lon = 0, 0
        pregnancy = max(int(item.get('Pregnancy_First') or 0), 0)
        handicap = max(int(item.get('Handicap_First') or 0), 0)
        car = max(max(int(item.get('totalcar') or 0), 0) - pregnancy - handicap, 0)
        row = (
            lot_id,
            item.get('area'),
            item.get('name'),
            item.get('type'),
            item.get('type2'),
            car,
            pregnancy,
            handicap,
            item.get('address'),
            lat,
            lon,
            item.get('serviceTime'),
            item.get('payex')
        )
        processed_list.append(row)
    
    return processed_list

def save_to_mysql(data_list):
    """負責與 MySQL 溝通並存入資料"""
    if not data_list:
        print("沒有資料可以存入")
        return
    print(f"寫入資料庫中(共 {len(data_list)} 筆)...")
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SET FOREIGN_KEY_CHECKS=0")
            cursor.execute("TRUNCATE TABLE parking_lot")
            cursor.execute("TRUNCATE TABLE parking_lot_status")
            sql = """
            INSERT INTO parking_lot (
                lot_id, area_id, lot_name, data_type, owner_type, car_space, pregnancy_space, handicap_space, addr, 
                latitude, longitude, service_time, charge
            ) VALUES (
                %s, 
                (SELECT area_id FROM area WHERE area_name = %s LIMIT 1), 
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE 
                area_id = VALUES(area_id),
                lot_name = VALUES(lot_name),
                addr = VALUES(addr)
            """
            cursor.executemany(sql, data_list)

            status_data_list = []
            for row in data_list:
                lot_type = row[3]
                if lot_type == '1' or lot_type == 1:
                    status_data_list.append((row[0],))
            sql_status = """
            INSERT INTO parking_lot_status (lot_id) 
            VALUES (%s)
            ON DUPLICATE KEY UPDATE lot_id = lot_id
            """
            cursor.executemany(sql_status, status_data_list)

            cursor.execute("SET FOREIGN_KEY_CHECKS=1")
        conn.commit()
        print("資料存入成功！")
    except Exception as e:
        conn.rollback()
        print(f"資料庫操作失敗: {e}")
    finally:
        conn.close()

# ==========================================
# 3. 執行入口 (Main Entry)
# ==========================================
if __name__ == "__main__":
    # 按照流程呼叫函數 (ETL 流程)
    raw_data = fetch_opendata()
    
    if raw_data:
        clean_data = transform_data(raw_data)
        save_to_mysql(clean_data)