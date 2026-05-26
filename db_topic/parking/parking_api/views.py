from django.shortcuts import render
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import datetime

@api_view(['GET'])
def get_parking_bounds(request):
    
    # ────────────────────────────────────────────────────────
    # 📌 第一步：接收參數與動態模式檢查
    # ────────────────────────────────────────────────────────
    min_lat = request.query_params.get('min_lat')
    max_lat = request.query_params.get('max_lat')
    min_lng = request.query_params.get('min_lng')
    max_lng = request.query_params.get('max_lng')
    
    # 基本的地圖邊界是一定要有的
    if not all([min_lat, max_lat, min_lng, max_lng]):
        return Response(
            {'error': '缺少地圖邊界參數，請確認 min_lat, max_lat, min_lng, max_lng 是否齊全'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
        
    # 嘗試獲取使用者定位（選填）
    user_lat = request.query_params.get('user_lat')
    user_lng = request.query_params.get('user_lng')
    
    # 🎯 核心邏輯：判斷目前是不是「搜尋附近 500 公尺模式」
    is_radius_mode = user_lat is not None and user_lng is not None
    
    # ────────────────────────────────────────────────────────
    # 📌 第二步：動態構建 SQL 語法與參數列表
    # ────────────────────────────────────────────────────────
    results = []
    
    with connection.cursor() as cursor:
        
        # 1. 撈取路外停車場 (lot)
        lot_base_query = """
            SELECT 
                'lot' AS type,
                p.lot_id, p.lot_name, p.addr, p.latitude, p.longitude, a.area_name, p.charge,
                p.car_space, p.pregnancy_space, p.handicap_space,
                s.ava_car, s.ava_pregnancy, s.ava_handicap, s.update_time
            FROM parking_lot p
            LEFT JOIN parking_lot_status s ON p.lot_id = s.lot_id
            LEFT JOIN area a ON p.area_id = a.area_id
            WHERE p.latitude BETWEEN %s AND %s 
              AND p.longitude BETWEEN %s AND %s
        """
        lot_params = [min_lat, max_lat, min_lng, max_lng]
        if is_radius_mode:
            # 🎯 如果是附近搜尋模式，動態在 WHERE 尾巴加上圓形過濾
            lot_base_query += """
                AND ST_Distance_Sphere(
                    ST_GeomFromText(CONCAT('POINT(', p.longitude, ' ', p.latitude, ')'), 4326),
                    ST_GeomFromText(CONCAT('POINT(', %s, ' ', %s, ')'), 4326)
                ) <= 500
            """
            lot_params.extend([user_lng, user_lat])
            
        cursor.execute(lot_base_query, lot_params)
        lot_columns = [col[0] for col in cursor.description]
        for row in cursor.fetchall():
            item = dict(zip(lot_columns, row))
            if item.get('update_time'):
                item['update_time'] = str(item['update_time'])
            results.append(item)


        # 2. 撈取路邊停車 (road)
        road_base_query = """
            SELECT 
                'road' AS type,
                r.road_id, r.road_name, r.latitude, r.longitude, a.area_name, r.geometry_wkt, r.charge,
                r.total_car, r.total_pregnancy, r.total_handicap,
                s.ava_car, s.ava_pregnancy, s.ava_handicap, s.update_time
            FROM road_side r
            LEFT JOIN road_side_status s ON r.road_id = s.road_id
            LEFT JOIN area a ON r.area_id = a.area_id
            WHERE r.latitude BETWEEN %s AND %s 
              AND r.longitude BETWEEN %s AND %s
        """
        road_params = [min_lat, max_lat, min_lng, max_lng]
        if is_radius_mode:
            road_base_query += """
                AND ST_Distance_Sphere(
                    ST_GeomFromText(CONCAT('POINT(', r.longitude, ' ', r.latitude, ')'), 4326),
                    ST_GeomFromText(CONCAT('POINT(', %s, ' ', %s, ')'), 4326)
                ) <= 500
            """
            road_params.extend([user_lng, user_lat])
            
        cursor.execute(road_base_query, road_params)
        road_columns = [col[0] for col in cursor.description]
        for row in cursor.fetchall():
            item = dict(zip(road_columns, row))
            if item.get('update_time'):
                item['update_time'] = str(item['update_time'])
            results.append(item)


        # 3. 撈取黃線管制 (yellow_line_test)
        yellow_base_query = """
            SELECT 
                'yellow_line' AS type,
                y.yl_id, y.road_name,
                a.area_name, y.geometry_wkt,
                y.control_time, y.holiday_time
            FROM yellow_line_test y
            LEFT JOIN area a ON y.area_id = a.area_id
            WHERE ST_Y(ST_StartPoint(ST_GeomFromText(y.geometry_wkt))) BETWEEN %s AND %s
              AND ST_X(ST_StartPoint(ST_GeomFromText(y.geometry_wkt))) BETWEEN %s AND %s
        """
        yellow_params = [min_lat, max_lat, min_lng, max_lng]
        if is_radius_mode:
            yellow_base_query += """
                AND ST_Distance_Sphere(
                    ST_StartPoint(ST_GeomFromText(y.geometry_wkt)),
                    ST_GeomFromText(CONCAT('POINT(', %s, ' ', %s, ')'), 4326)
                ) <= 500
            """
            yellow_params.extend([user_lng, user_lat])
            
        cursor.execute(yellow_base_query, yellow_params)
        yellow_columns = [col[0] for col in cursor.description]
        for row in cursor.fetchall():
            item = dict(zip(yellow_columns, row))
            if isinstance(item.get('control_time'), (datetime.time, datetime.timedelta)):
                item['control_time'] = str(item['control_time'])
            if isinstance(item.get('holiday_time'), (datetime.time, datetime.timedelta)):
                item['holiday_time'] = str(item['holiday_time'])
            results.append(item)
        
    # ────────────────────────────────────────────────────────
    # 📌 第三步：打包格式並回傳給前端 (Response)
    # ────────────────────────────────────────────────────────
    return Response(results, status=status.HTTP_200_OK)
