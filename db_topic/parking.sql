-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- 主機： localhost
-- 產生時間： 2026 年 05 月 23 日 09:16
-- 伺服器版本： 10.4.28-MariaDB
-- PHP 版本： 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 資料庫： `parking`
--

-- --------------------------------------------------------

--
-- 資料表結構 `area`
--

CREATE TABLE `area` (
  `area_id` int(3) NOT NULL,
  `area_name` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- 傾印資料表的資料 `area`
--

INSERT INTO `area` (`area_id`, `area_name`) VALUES
(100, '中正區'),
(103, '大同區'),
(104, '中山區'),
(105, '松山區'),
(106, '大安區'),
(108, '萬華區'),
(110, '信義區'),
(111, '士林區'),
(112, '北投區'),
(114, '內湖區'),
(115, '南港區'),
(116, '文山區'),
(200, '未知');

-- --------------------------------------------------------

--
-- 資料表結構 `parking_lot`
--

CREATE TABLE `parking_lot` (
  `lot_id` varchar(11) NOT NULL,
  `area_id` int(3) NOT NULL,
  `lot_name` varchar(50) NOT NULL,
  `data_type` tinyint(1) NOT NULL,
  `owner_type` varchar(50) DEFAULT NULL,
  `addr` varchar(200) NOT NULL,
  `car_space` int(10) NOT NULL,
  `pregnancy_space` int(10) DEFAULT NULL,
  `handicap_space` int(10) DEFAULT NULL,
  `service_time` varchar(500) DEFAULT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `charge` varchar(500) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `parking_lot_status`
--

CREATE TABLE `parking_lot_status` (
  `lot_id` varchar(11) NOT NULL,
  `ava_car` int(10) DEFAULT NULL,
  `ava_handicap` int(11) DEFAULT NULL,
  `ava_pregnancy` int(11) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `road_side`
--

CREATE TABLE `road_side` (
  `road_id` varchar(10) NOT NULL,
  `area_id` int(3) NOT NULL,
  `road_name` varchar(255) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `geometry_wkt` text DEFAULT NULL,
  `total_car` int(10) NOT NULL,
  `total_pregnancy` int(11) NOT NULL,
  `total_handicap` int(11) NOT NULL,
  `charge` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `road_side_status`
--

CREATE TABLE `road_side_status` (
  `road_id` varchar(10) NOT NULL,
  `ava_car` int(11) DEFAULT NULL,
  `ava_pregnancy` int(11) DEFAULT NULL,
  `ava_handicap` int(11) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `search_history`
--

CREATE TABLE `search_history` (
  `search_id` int(11) NOT NULL,
  `user_latitude` decimal(10,7) NOT NULL,
  `user_longitude` decimal(10,7) NOT NULL,
  `search_type` tinyint(1) NOT NULL,
  `search_time` time NOT NULL,
  `keyword` varchar(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `update_history`
--

CREATE TABLE `update_history` (
  `his_id` int(11) NOT NULL,
  `data_type` varchar(11) NOT NULL,
  `source_name` varchar(50) NOT NULL,
  `status` varchar(11) NOT NULL,
  `note` varchar(50) NOT NULL,
  `update_time` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `yellow_line`
--

CREATE TABLE `yellow_line` (
  `yl_id` int(5) NOT NULL,
  `area_id` int(3) NOT NULL,
  `road_name` varchar(50) NOT NULL,
  `direction` varchar(5) NOT NULL,
  `start` varchar(10) NOT NULL,
  `end` varchar(10) NOT NULL,
  `road_geo` linestring NOT NULL,
  `standard_period` tinyint(1) NOT NULL,
  `control_time` time NOT NULL,
  `holiday_time` time NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- 已傾印資料表的索引
--

--
-- 資料表索引 `area`
--
ALTER TABLE `area`
  ADD PRIMARY KEY (`area_id`);

--
-- 資料表索引 `parking_lot`
--
ALTER TABLE `parking_lot`
  ADD PRIMARY KEY (`lot_id`),
  ADD KEY `area_id` (`area_id`);

--
-- 資料表索引 `parking_lot_status`
--
ALTER TABLE `parking_lot_status`
  ADD PRIMARY KEY (`lot_id`);

--
-- 資料表索引 `road_side`
--
ALTER TABLE `road_side`
  ADD PRIMARY KEY (`road_id`),
  ADD KEY `road_side_ibfk_1` (`area_id`);

--
-- 資料表索引 `road_side_status`
--
ALTER TABLE `road_side_status`
  ADD KEY `road_id` (`road_id`);

--
-- 資料表索引 `search_history`
--
ALTER TABLE `search_history`
  ADD PRIMARY KEY (`search_id`);

--
-- 資料表索引 `update_history`
--
ALTER TABLE `update_history`
  ADD PRIMARY KEY (`his_id`);

--
-- 資料表索引 `yellow_line`
--
ALTER TABLE `yellow_line`
  ADD PRIMARY KEY (`yl_id`),
  ADD KEY `yellow_line_ibfk_1` (`area_id`);

--
-- 在傾印的資料表使用自動遞增(AUTO_INCREMENT)
--

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `search_history`
--
ALTER TABLE `search_history`
  MODIFY `search_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `update_history`
--
ALTER TABLE `update_history`
  MODIFY `his_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `yellow_line`
--
ALTER TABLE `yellow_line`
  MODIFY `yl_id` int(5) NOT NULL AUTO_INCREMENT;

--
-- 已傾印資料表的限制式
--

--
-- 資料表的限制式 `parking_lot`
--
ALTER TABLE `parking_lot`
  ADD CONSTRAINT `parking_lot_ibfk_1` FOREIGN KEY (`area_id`) REFERENCES `area` (`area_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- 資料表的限制式 `parking_lot_status`
--
ALTER TABLE `parking_lot_status`
  ADD CONSTRAINT `parking_lot_status_ibfk_1` FOREIGN KEY (`lot_id`) REFERENCES `parking_lot` (`lot_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- 資料表的限制式 `road_side`
--
ALTER TABLE `road_side`
  ADD CONSTRAINT `road_side_ibfk_1` FOREIGN KEY (`area_id`) REFERENCES `area` (`area_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- 資料表的限制式 `road_side_status`
--
ALTER TABLE `road_side_status`
  ADD CONSTRAINT `road_side_status_ibfk_1` FOREIGN KEY (`road_id`) REFERENCES `road_side` (`road_id`) ON UPDATE CASCADE;

--
-- 資料表的限制式 `yellow_line`
--
ALTER TABLE `yellow_line`
  ADD CONSTRAINT `yellow_line_ibfk_1` FOREIGN KEY (`area_id`) REFERENCES `area` (`area_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
