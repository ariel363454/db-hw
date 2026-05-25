from django.shortcuts import render
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import datetime

@api_view(['GET'])
def get_parking_bounds(request):

    
    # ────────────────────────────────────────────────────────
    # 📌 第一步：接收參數與安全檢查 (防呆機制)
    # ────────────────────────────────────────────────────────
    min_lat = request.query_params.get('min_lat')
    max_lat = request.query_params.get('max_lat')
    min_lng = request.query_params.get('min_lng')
    max_lng = request.query_params.get('max_lng')
    
    if not all([min_lat, max_lat, min_lng, max_lng]):
        return Response(
            {'error': '缺少地圖邊界參數，請確認 min_lat, max_lat, min_lng, max_lng 是否齊全'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
        
    # ────────────────────────────────────────────────────────
    # 📌 第二步：與資料庫互動 (核心業務邏輯)
    # ────────────────────────────────────────────────────────
    results = []
    
    with connection.cursor() as cursor:
        lot_query = """
            SELECT 
                'lot' AS type,
                p.lot_id, p.lot_name, p.addr, p.latitude, p.longitude, p.charge,
                p.car_space, p.pregnancy_space, p.handicap_space,
                s.ava_car, s.ava_pregnancy, s.ava_handicap, s.update_time
            FROM parking_lot p
            LEFT JOIN parking_lot_status s ON p.lot_id = s.lot_id
            WHERE p.latitude BETWEEN %s AND %s 
              AND p.longitude BETWEEN %s AND %s
        """
        cursor.execute(lot_query, [min_lat, max_lat, min_lng, max_lng])
        lot_columns = [col[0] for col in cursor.description]
        for row in cursor.fetchall():
            item = dict(zip(lot_columns, row))
            if item.get('update_time'):
                item['update_time'] = str(item['update_time'])
            results.append(item)

        road_query = """
            SELECT 
                'road' AS type,
                r.road_id, r.road_name, r.latitude, r.longitude, r.geometry_wkt, r.charge,
                r.total_car, r.total_pregnancy, r.total_handicap,
                s.ava_car, s.ava_pregnancy, s.ava_handicap, s.update_time
            FROM road_side r
            LEFT JOIN road_side_status s ON r.road_id = s.road_id
            WHERE r.latitude BETWEEN %s AND %s 
              AND r.longitude BETWEEN %s AND %s
        """
        cursor.execute(road_query, [min_lat, max_lat, min_lng, max_lng])
        road_columns = [col[0] for col in cursor.description]
        for row in cursor.fetchall():
            item = dict(zip(road_columns, row))
            if item.get('update_time'):
                item['update_time'] = str(item['update_time'])
            results.append(item)

        yellow_query = """
            SELECT 
                'yellow_line' AS type,
                y.yl_id, y.road_name, y.direction,
                ST_Y(ST_StartPoint(ST_GeomFromText(y.geometry_wkt))) AS latitude,
                ST_X(ST_StartPoint(ST_GeomFromText(y.geometry_wkt))) AS longitude,
                y.geometry_wkt,
                y.standard_period, y.control_time, y.holiday_time
            FROM yellow_line_real y
            WHERE ST_Y(ST_StartPoint(ST_GeomFromText(y.geometry_wkt))) BETWEEN %s AND %s
              AND ST_X(ST_StartPoint(ST_GeomFromText(y.geometry_wkt))) BETWEEN %s AND %s
        """
        cursor.execute(yellow_query, [min_lat, max_lat, min_lng, max_lng])
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