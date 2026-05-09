-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: bitac_pms
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `user_type` enum('staff','customer') NOT NULL DEFAULT 'staff',
  `action` varchar(255) NOT NULL,
  `model_type` varchar(255) DEFAULT NULL,
  `model_id` bigint(20) unsigned DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_model_type_model_id_index` (`model_type`,`model_id`),
  KEY `audit_logs_user_id_index` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,4,'staff','job_started','JobExecution',3,NULL,'{\"message\":\"Job started: WO-2026-0001 on HT Furnace 1 by Machine Operator\"}','127.0.0.1','2026-04-02 06:57:46','2026-04-02 06:57:46'),(2,4,'staff','job_stopped','JobExecution',2,NULL,'{\"message\":\"Job completed: WO-2026-0001 Step 2 \\u2014 48 pcs\"}','127.0.0.1','2026-04-02 04:57:46','2026-04-02 04:57:46'),(3,5,'staff','qc_hold','WorkOrder',2,NULL,'{\"message\":\"QC Hold placed: WO-2026-0002 by QC Inspector\"}','127.0.0.1','2026-04-02 07:57:46','2026-04-02 07:57:46'),(4,5,'staff','ncr_created','Ncr',1,NULL,'{\"message\":\"NCR raised: NCR-2026-001 on WO-2026-0002 \\u2014 Dimensional Non-conformance\"}','127.0.0.1','2026-04-02 08:12:46','2026-04-02 08:12:46'),(5,4,'staff','job_started','JobExecution',1,NULL,'{\"message\":\"Job started: WO-2026-0001 Step 1 on CNC Lathe 1\"}','127.0.0.1','2026-04-01 22:57:46','2026-04-01 22:57:46');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_items`
--

DROP TABLE IF EXISTS `bom_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bom_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `bom_id` bigint(20) unsigned NOT NULL,
  `material_name` varchar(255) NOT NULL,
  `material_code` varchar(255) DEFAULT NULL,
  `quantity` decimal(10,4) NOT NULL,
  `unit` varchar(255) NOT NULL DEFAULT 'kg',
  `wastage_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bom_items_bom_id_foreign` (`bom_id`),
  CONSTRAINT `bom_items_bom_id_foreign` FOREIGN KEY (`bom_id`) REFERENCES `boms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_items`
--

LOCK TABLES `bom_items` WRITE;
/*!40000 ALTER TABLE `bom_items` DISABLE KEYS */;
INSERT INTO `bom_items` VALUES (1,1,'EN24 Steel Bar (40mm dia)','RM-EN24-40',1.5000,'kg',8.00,'2026-04-02 08:57:40','2026-04-02 08:57:40'),(2,1,'Cutting Oil','RM-CUT-OIL',0.2000,'ltr',0.00,'2026-04-02 08:57:40','2026-04-02 08:57:40'),(3,1,'Grinding Wheel','RM-GW-125',0.0500,'pcs',0.00,'2026-04-02 08:57:40','2026-04-02 08:57:40'),(4,2,'Carbon Steel A105 Plate','RM-CS-A105',2.8000,'kg',12.00,'2026-04-02 08:57:41','2026-04-02 08:57:41'),(5,2,'Cutting Disc','RM-CD-230',0.1000,'pcs',0.00,'2026-04-02 08:57:41','2026-04-02 08:57:41'),(6,3,'Phosphor Bronze Bar','RM-PB-50',0.8000,'kg',10.00,'2026-04-02 08:57:41','2026-04-02 08:57:41'),(7,4,'MS Plate 10mm','RM-MS-10',3.5000,'kg',15.00,'2026-04-02 08:57:41','2026-04-02 08:57:41'),(8,4,'Welding Electrode E6013','RM-WE-6013',0.1500,'kg',5.00,'2026-04-02 08:57:41','2026-04-02 08:57:41'),(9,4,'Primer Paint','RM-PP-GRY',0.1000,'ltr',0.00,'2026-04-02 08:57:41','2026-04-02 08:57:41'),(10,5,'Cast Iron Blank 200mm','RM-CI-200',4.2000,'kg',20.00,'2026-04-02 08:57:41','2026-04-02 08:57:41'),(11,5,'Cutting Tool Insert','RM-CT-CNMG',0.0200,'pcs',0.00,'2026-04-02 08:57:42','2026-04-02 08:57:42');
/*!40000 ALTER TABLE `bom_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `boms`
--

DROP TABLE IF EXISTS `boms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `boms` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `version` varchar(255) NOT NULL DEFAULT '1.0',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `boms_product_id_foreign` (`product_id`),
  CONSTRAINT `boms_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boms`
--

LOCK TABLES `boms` WRITE;
/*!40000 ALTER TABLE `boms` DISABLE KEYS */;
INSERT INTO `boms` VALUES (1,1,'1.0',1,'Initial BOM - Standard version','2026-04-02 08:57:40','2026-04-02 08:57:40'),(2,2,'1.0',1,'Initial BOM - Standard version','2026-04-02 08:57:41','2026-04-02 08:57:41'),(3,3,'1.0',1,'Initial BOM - Standard version','2026-04-02 08:57:41','2026-04-02 08:57:41'),(4,4,'1.0',1,'Initial BOM - Standard version','2026-04-02 08:57:41','2026-04-02 08:57:41'),(5,5,'1.0',1,'Initial BOM - Standard version','2026-04-02 08:57:41','2026-04-02 08:57:41');
/*!40000 ALTER TABLE `boms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_notifications`
--

DROP TABLE IF EXISTS `customer_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned NOT NULL,
  `work_order_id` bigint(20) unsigned DEFAULT NULL,
  `type` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_notifications_customer_id_foreign` (`customer_id`),
  KEY `customer_notifications_work_order_id_foreign` (`work_order_id`),
  CONSTRAINT `customer_notifications_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_notifications_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_notifications`
--

LOCK TABLES `customer_notifications` WRITE;
/*!40000 ALTER TABLE `customer_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'Bangladesh Railway','Md. Aminul Islam','railway@customer.bitac.gov.bd','01711-000001','Rail Bhaban, Abdul Gani Road, Dhaka-1000','$2y$12$MDSQOWaWTG6gCoCBZqB14OPGuq0mOk8lCc6yu4Z3n0f7TIr/seHU2',1,NULL,'2026-04-02 08:57:38','2026-04-02 08:57:38'),(2,'BPDB (Bangladesh Power Development Board)','Engr. Rahim Uddin','bpdb@customer.bitac.gov.bd','01711-000002','WAPDA Building, Motijheel, Dhaka-1000','$2y$12$wdqdazfPvYaXjyD3XiIuCuKrgChL.4d9r3TI30yH/i3mWigYmVHoq',1,NULL,'2026-04-02 08:57:39','2026-04-02 08:57:39'),(3,'Bangladesh Shipyard','Captain Fazlul Haque','shipyard@customer.bitac.gov.bd','01711-000003','Chittagong Port Area, Chittagong','$2y$12$ga/rK7Y07yfu0XgFCYdOG.p4buZqEdH8ShU4RKAYCX9Karm9X/h.y',1,NULL,'2026-04-02 08:57:39','2026-04-02 08:57:39');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_orders`
--

DROP TABLE IF EXISTS `delivery_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `delivery_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `work_order_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `scheduled_date` date NOT NULL,
  `transport_notes` text DEFAULT NULL,
  `status` enum('scheduled','dispatched','delivered') NOT NULL DEFAULT 'scheduled',
  `challan_number` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `delivery_orders_challan_number_unique` (`challan_number`),
  KEY `delivery_orders_work_order_id_foreign` (`work_order_id`),
  KEY `delivery_orders_customer_id_foreign` (`customer_id`),
  CONSTRAINT `delivery_orders_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `delivery_orders_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_orders`
--

LOCK TABLES `delivery_orders` WRITE;
/*!40000 ALTER TABLE `delivery_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `downtime_events`
--

DROP TABLE IF EXISTS `downtime_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `downtime_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `job_execution_id` bigint(20) unsigned NOT NULL,
  `machine_id` bigint(20) unsigned NOT NULL,
  `category` enum('machine_breakdown','material_shortage','operator_absence','power_outage','other') NOT NULL DEFAULT 'other',
  `description` text DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `downtime_events_job_execution_id_foreign` (`job_execution_id`),
  KEY `downtime_events_machine_id_foreign` (`machine_id`),
  CONSTRAINT `downtime_events_job_execution_id_foreign` FOREIGN KEY (`job_execution_id`) REFERENCES `job_executions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `downtime_events_machine_id_foreign` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `downtime_events`
--

LOCK TABLES `downtime_events` WRITE;
/*!40000 ALTER TABLE `downtime_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `downtime_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ims_integration_logs`
--

DROP TABLE IF EXISTS `ims_integration_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ims_integration_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `query_type` varchar(255) NOT NULL,
  `request_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`request_payload`)),
  `response_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`response_payload`)),
  `status` enum('success','failed') NOT NULL DEFAULT 'success',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ims_integration_logs`
--

LOCK TABLES `ims_integration_logs` WRITE;
/*!40000 ALTER TABLE `ims_integration_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `ims_integration_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoices` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `work_order_id` bigint(20) unsigned NOT NULL,
  `delivery_order_id` bigint(20) unsigned DEFAULT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `invoice_number` varchar(255) NOT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `vat_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `status` enum('draft','issued','acknowledged') NOT NULL DEFAULT 'draft',
  `issued_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_invoice_number_unique` (`invoice_number`),
  KEY `invoices_work_order_id_foreign` (`work_order_id`),
  KEY `invoices_delivery_order_id_foreign` (`delivery_order_id`),
  KEY `invoices_customer_id_foreign` (`customer_id`),
  CONSTRAINT `invoices_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_delivery_order_id_foreign` FOREIGN KEY (`delivery_order_id`) REFERENCES `delivery_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_executions`
--

DROP TABLE IF EXISTS `job_executions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_executions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `operation_step_id` bigint(20) unsigned NOT NULL,
  `work_order_id` bigint(20) unsigned NOT NULL,
  `operator_id` bigint(20) unsigned NOT NULL,
  `machine_id` bigint(20) unsigned NOT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `stopped_at` timestamp NULL DEFAULT NULL,
  `qty_completed` decimal(10,2) NOT NULL DEFAULT 0.00,
  `qty_rejected` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reject_reason` varchar(255) DEFAULT NULL,
  `status` enum('started','stopped') NOT NULL DEFAULT 'started',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `job_executions_operation_step_id_foreign` (`operation_step_id`),
  KEY `job_executions_work_order_id_foreign` (`work_order_id`),
  KEY `job_executions_operator_id_foreign` (`operator_id`),
  KEY `job_executions_machine_id_foreign` (`machine_id`),
  CONSTRAINT `job_executions_machine_id_foreign` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `job_executions_operation_step_id_foreign` FOREIGN KEY (`operation_step_id`) REFERENCES `operation_steps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `job_executions_operator_id_foreign` FOREIGN KEY (`operator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `job_executions_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_executions`
--

LOCK TABLES `job_executions` WRITE;
/*!40000 ALTER TABLE `job_executions` DISABLE KEYS */;
INSERT INTO `job_executions` VALUES (1,1,1,4,1,'2026-04-01 22:57:44','2026-04-02 01:57:44',50.00,2.00,'Minor surface defect','stopped','2026-04-02 08:57:44','2026-04-02 08:57:44'),(2,2,1,4,1,'2026-04-02 02:57:44','2026-04-02 04:57:44',48.00,0.00,NULL,'stopped','2026-04-02 08:57:44','2026-04-02 08:57:44'),(3,3,1,4,4,'2026-04-02 06:57:44',NULL,0.00,0.00,NULL,'started','2026-04-02 08:57:44','2026-04-02 08:57:44');
/*!40000 ALTER TABLE `job_executions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
INSERT INTO `jobs` VALUES (1,'default','{\"uuid\":\"1655bf44-5929-443c-9e20-87928d388d45\",\"displayName\":\"App\\\\Events\\\\JobExecutionStarted\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":17:{s:5:\\\"event\\\";O:30:\\\"App\\\\Events\\\\JobExecutionStarted\\\":1:{s:12:\\\"jobExecution\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:23:\\\"App\\\\Models\\\\JobExecution\\\";s:2:\\\"id\\\";i:3;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:23:\\\"deleteWhenMissingModels\\\";b:1;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:12:\\\"deduplicator\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\",\"batchId\":null},\"createdAt\":1775120264,\"delay\":null}',0,NULL,1775120264,1775120264),(2,'default','{\"uuid\":\"e3e92b1c-4697-40c1-a80e-6888ccd88916\",\"displayName\":\"App\\\\Events\\\\NCRCreated\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\",\"command\":\"O:38:\\\"Illuminate\\\\Broadcasting\\\\BroadcastEvent\\\":17:{s:5:\\\"event\\\";O:21:\\\"App\\\\Events\\\\NCRCreated\\\":1:{s:3:\\\"ncr\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:14:\\\"App\\\\Models\\\\Ncr\\\";s:2:\\\"id\\\";i:1;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:7:\\\"backoff\\\";N;s:13:\\\"maxExceptions\\\";N;s:23:\\\"deleteWhenMissingModels\\\";b:1;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:12:\\\"deduplicator\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\",\"batchId\":null},\"createdAt\":1775120266,\"delay\":null}',0,NULL,1775120266,1775120266);
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machines`
--

DROP TABLE IF EXISTS `machines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `machines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `work_centre_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `machine_code` varchar(255) NOT NULL,
  `status` enum('active','maintenance','breakdown') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `machines_machine_code_unique` (`machine_code`),
  KEY `machines_work_centre_id_foreign` (`work_centre_id`),
  CONSTRAINT `machines_work_centre_id_foreign` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machines`
--

LOCK TABLES `machines` WRITE;
/*!40000 ALTER TABLE `machines` DISABLE KEYS */;
INSERT INTO `machines` VALUES (1,1,'CNC Lathe 1','MS-CL-001','active','2026-04-02 08:57:39','2026-04-02 08:57:39'),(2,1,'CNC Milling Machine','MS-CM-002','active','2026-04-02 08:57:39','2026-04-02 08:57:39'),(3,1,'Conventional Lathe','MS-VL-003','active','2026-04-02 08:57:39','2026-04-02 08:57:39'),(4,2,'Furnace 1 (Box Type)','HT-BF-001','active','2026-04-02 08:57:39','2026-04-02 08:57:39'),(5,2,'Induction Hardener','HT-IH-002','active','2026-04-02 08:57:39','2026-04-02 08:57:39'),(6,2,'Salt Bath Furnace','HT-SB-003','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(7,3,'Press Brake 100T','FB-PB-001','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(8,3,'Shearing Machine','FB-SM-002','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(9,3,'Rolling Machine','FB-RM-003','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(10,4,'MIG Welder 1','WL-MG-001','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(11,4,'TIG Welder 1','WL-TG-002','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(12,4,'Arc Welder','WL-AW-003','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(13,5,'Assembly Station 1','AS-ST-001','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(14,5,'Assembly Station 2','AS-ST-002','active','2026-04-02 08:57:40','2026-04-02 08:57:40'),(15,5,'Test Bench','AS-TB-003','active','2026-04-02 08:57:40','2026-04-02 08:57:40');
/*!40000 ALTER TABLE `machines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_requisition_notes`
--

DROP TABLE IF EXISTS `material_requisition_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `material_requisition_notes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `work_order_id` bigint(20) unsigned NOT NULL,
  `material_name` varchar(255) NOT NULL,
  `material_code` varchar(255) DEFAULT NULL,
  `required_qty` decimal(10,4) NOT NULL,
  `available_qty` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `shortage_qty` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `unit` varchar(255) NOT NULL DEFAULT 'kg',
  `status` enum('pending','issued','partial') NOT NULL DEFAULT 'pending',
  `requested_by` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `material_requisition_notes_work_order_id_foreign` (`work_order_id`),
  KEY `material_requisition_notes_requested_by_foreign` (`requested_by`),
  CONSTRAINT `material_requisition_notes_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `material_requisition_notes_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_requisition_notes`
--

LOCK TABLES `material_requisition_notes` WRITE;
/*!40000 ALTER TABLE `material_requisition_notes` DISABLE KEYS */;
INSERT INTO `material_requisition_notes` VALUES (1,1,'EN24 Steel Bar (40mm dia)','RM-EN24-40',81.0000,65.0000,16.0000,'kg','pending',6,'2026-04-02 08:57:44','2026-04-02 08:57:44'),(2,1,'Cutting Oil','RM-CUT-OIL',10.0000,10.0000,0.0000,'ltr','issued',6,'2026-04-02 08:57:44','2026-04-02 08:57:44'),(3,1,'Grinding Wheel','RM-GW-125',2.5000,2.5000,0.0000,'pcs','issued',6,'2026-04-02 08:57:44','2026-04-02 08:57:44');
/*!40000 ALTER TABLE `material_requisition_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2025_01_01_000000_create_permission_tables',1),(5,'2025_01_01_000001_create_customers_table',1),(6,'2025_01_01_000002_create_work_centres_table',1),(7,'2025_01_01_000003_create_machines_table',1),(8,'2025_01_01_000004_create_products_table',1),(9,'2025_01_01_000005_create_boms_table',1),(10,'2025_01_01_000006_create_bom_items_table',1),(11,'2025_01_01_000007_create_rfqs_table',1),(12,'2025_01_01_000008_create_quotations_table',1),(13,'2025_01_01_000009_create_quotation_items_table',1),(14,'2025_01_01_000010_create_quotation_approvals_table',1),(15,'2025_01_01_000011_create_work_orders_table',1),(16,'2025_01_01_000012_create_operation_sheets_table',1),(17,'2025_01_01_000013_create_operation_steps_table',1),(18,'2025_01_01_000014_create_operator_assignments_table',1),(19,'2025_01_01_000015_create_production_schedules_table',1),(20,'2025_01_01_000016_create_job_executions_table',1),(21,'2025_01_01_000017_create_downtime_events_table',1),(22,'2025_01_01_000018_create_material_requisition_notes_table',1),(23,'2025_01_01_000019_create_qc_inspections_table',1),(24,'2025_01_01_000020_create_qc_checklist_items_table',1),(25,'2025_01_01_000021_create_ncrs_table',1),(26,'2025_01_01_000022_create_rework_orders_table',1),(27,'2025_01_01_000023_create_delivery_orders_table',1),(28,'2025_01_01_000024_create_proof_of_deliveries_table',1),(29,'2025_01_01_000025_create_invoices_table',1),(30,'2025_01_01_000026_create_customer_notifications_table',1),(31,'2025_01_01_000027_create_audit_logs_table',1),(32,'2025_01_01_000028_create_ims_integration_logs_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_permissions`
--

DROP TABLE IF EXISTS `model_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`model_id`,`model_type`),
  KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_permissions`
--

LOCK TABLES `model_has_permissions` WRITE;
/*!40000 ALTER TABLE `model_has_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `model_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_roles`
--

DROP TABLE IF EXISTS `model_has_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_has_roles` (
  `role_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`model_id`,`model_type`),
  KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_roles`
--

LOCK TABLES `model_has_roles` WRITE;
/*!40000 ALTER TABLE `model_has_roles` DISABLE KEYS */;
INSERT INTO `model_has_roles` VALUES (1,'App\\Models\\User',1),(2,'App\\Models\\User',2),(3,'App\\Models\\User',3),(4,'App\\Models\\User',4),(5,'App\\Models\\User',5),(6,'App\\Models\\User',6),(7,'App\\Models\\User',7),(8,'App\\Models\\User',8),(9,'App\\Models\\User',9),(10,'App\\Models\\User',10);
/*!40000 ALTER TABLE `model_has_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ncrs`
--

DROP TABLE IF EXISTS `ncrs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ncrs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `qc_inspection_id` bigint(20) unsigned NOT NULL,
  `work_order_id` bigint(20) unsigned NOT NULL,
  `ncr_number` varchar(255) NOT NULL,
  `defect_type` varchar(255) NOT NULL,
  `root_cause` text DEFAULT NULL,
  `corrective_action` text DEFAULT NULL,
  `responsible_user_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('open','in_rework','closed') NOT NULL DEFAULT 'open',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ncrs_ncr_number_unique` (`ncr_number`),
  KEY `ncrs_qc_inspection_id_foreign` (`qc_inspection_id`),
  KEY `ncrs_work_order_id_foreign` (`work_order_id`),
  KEY `ncrs_responsible_user_id_foreign` (`responsible_user_id`),
  CONSTRAINT `ncrs_qc_inspection_id_foreign` FOREIGN KEY (`qc_inspection_id`) REFERENCES `qc_inspections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ncrs_responsible_user_id_foreign` FOREIGN KEY (`responsible_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ncrs_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ncrs`
--

LOCK TABLES `ncrs` WRITE;
/*!40000 ALTER TABLE `ncrs` DISABLE KEYS */;
INSERT INTO `ncrs` VALUES (1,1,2,'NCR-2026-001','Dimensional Non-conformance','Tool wear not compensated in CNC program','Re-machine to correct dimension. Update tool offset in program.',3,'open','2026-04-02 08:57:45','2026-04-02 08:57:45');
/*!40000 ALTER TABLE `ncrs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operation_sheets`
--

DROP TABLE IF EXISTS `operation_sheets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `operation_sheets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `work_order_id` bigint(20) unsigned NOT NULL,
  `sheet_number` varchar(255) NOT NULL,
  `qr_code` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `approved_by` bigint(20) unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `operation_sheets_work_order_id_foreign` (`work_order_id`),
  KEY `operation_sheets_approved_by_foreign` (`approved_by`),
  CONSTRAINT `operation_sheets_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `operation_sheets_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_sheets`
--

LOCK TABLES `operation_sheets` WRITE;
/*!40000 ALTER TABLE `operation_sheets` DISABLE KEYS */;
INSERT INTO `operation_sheets` VALUES (1,1,'01','WO-2026-0001-SHEET-01','Follow all safety protocols. Use PPE at all times.',3,'2026-03-30 08:57:42','2026-04-02 08:57:42','2026-04-02 08:57:42'),(2,2,'01','WO-2026-0002-SHEET-01',NULL,3,'2026-04-01 08:57:45','2026-04-02 08:57:45','2026-04-02 08:57:45');
/*!40000 ALTER TABLE `operation_sheets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operation_steps`
--

DROP TABLE IF EXISTS `operation_steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `operation_steps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `operation_sheet_id` bigint(20) unsigned NOT NULL,
  `sequence` int(11) NOT NULL,
  `operation_name` varchar(255) NOT NULL,
  `machine_id` bigint(20) unsigned DEFAULT NULL,
  `estimated_hours` decimal(8,2) NOT NULL DEFAULT 0.00,
  `tooling_notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `operation_steps_operation_sheet_id_foreign` (`operation_sheet_id`),
  KEY `operation_steps_machine_id_foreign` (`machine_id`),
  CONSTRAINT `operation_steps_machine_id_foreign` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE SET NULL,
  CONSTRAINT `operation_steps_operation_sheet_id_foreign` FOREIGN KEY (`operation_sheet_id`) REFERENCES `operation_sheets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_steps`
--

LOCK TABLES `operation_steps` WRITE;
/*!40000 ALTER TABLE `operation_steps` DISABLE KEYS */;
INSERT INTO `operation_steps` VALUES (1,1,1,'Rough Turning',1,2.50,'Use CNMG insert, depth of cut 3mm, feed 0.3mm/rev','2026-04-02 08:57:42','2026-04-02 08:57:42'),(2,1,2,'Finish Turning',1,1.50,'Use CNMG insert fine, depth of cut 0.5mm, feed 0.1mm/rev','2026-04-02 08:57:43','2026-04-02 08:57:43'),(3,1,3,'Heat Treatment (Hardening)',4,4.00,'Harden at 850°C, quench in oil, temper at 200°C','2026-04-02 08:57:43','2026-04-02 08:57:43'),(4,1,4,'Grinding',1,1.00,'Final size: 38.98-39.00mm, Ra 0.8','2026-04-02 08:57:43','2026-04-02 08:57:43'),(5,1,5,'Inspection & Packing',15,0.50,'Final dimension check. Pack in oiled paper.','2026-04-02 08:57:43','2026-04-02 08:57:43'),(6,2,1,'Press Forming',7,3.00,'Use 100T die set D-002','2026-04-02 08:57:45','2026-04-02 08:57:45');
/*!40000 ALTER TABLE `operation_steps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operator_assignments`
--

DROP TABLE IF EXISTS `operator_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `operator_assignments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `operation_step_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `shift` enum('morning','evening','night') NOT NULL DEFAULT 'morning',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `operator_assignments_operation_step_id_foreign` (`operation_step_id`),
  KEY `operator_assignments_user_id_foreign` (`user_id`),
  CONSTRAINT `operator_assignments_operation_step_id_foreign` FOREIGN KEY (`operation_step_id`) REFERENCES `operation_steps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `operator_assignments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operator_assignments`
--

LOCK TABLES `operator_assignments` WRITE;
/*!40000 ALTER TABLE `operator_assignments` DISABLE KEYS */;
INSERT INTO `operator_assignments` VALUES (1,1,4,'morning','2026-04-02 08:57:42','2026-04-02 08:57:42'),(2,2,4,'morning','2026-04-02 08:57:43','2026-04-02 08:57:43'),(3,3,4,'morning','2026-04-02 08:57:43','2026-04-02 08:57:43'),(4,4,4,'morning','2026-04-02 08:57:43','2026-04-02 08:57:43'),(5,5,4,'morning','2026-04-02 08:57:44','2026-04-02 08:57:44');
/*!40000 ALTER TABLE `operator_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'view dashboard','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(2,'view live dashboard','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(3,'view rfqs','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(4,'create rfqs','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(5,'edit rfqs','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(6,'delete rfqs','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(7,'view quotations','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(8,'create quotations','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(9,'edit quotations','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(10,'approve quotations','web','2026-04-02 08:57:30','2026-04-02 08:57:30'),(11,'reject quotations','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(12,'convert quotations','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(13,'view work-orders','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(14,'create work-orders','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(15,'edit work-orders','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(16,'approve work-orders','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(17,'view mrp','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(18,'run mrp','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(19,'create requisitions','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(20,'view operation-sheets','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(21,'create operation-sheets','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(22,'approve operation-sheets','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(23,'view schedule','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(24,'manage schedule','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(25,'view shop-floor','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(26,'start jobs','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(27,'stop jobs','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(28,'log downtime','web','2026-04-02 08:57:31','2026-04-02 08:57:31'),(29,'view wip','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(30,'view qc','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(31,'create qc-inspections','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(32,'create ncrs','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(33,'view qc-reports','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(34,'view delivery','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(35,'create delivery','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(36,'complete delivery','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(37,'view invoices','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(38,'create invoices','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(39,'download invoices','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(40,'view reports','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(41,'export reports','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(42,'manage users','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(43,'manage customers','web','2026-04-02 08:57:32','2026-04-02 08:57:32'),(44,'view audit-log','web','2026-04-02 08:57:33','2026-04-02 08:57:33'),(45,'view customer-portal','web','2026-04-02 08:57:33','2026-04-02 08:57:33');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_schedules`
--

DROP TABLE IF EXISTS `production_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `production_schedules` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `operation_step_id` bigint(20) unsigned NOT NULL,
  `machine_id` bigint(20) unsigned NOT NULL,
  `scheduled_date` date NOT NULL,
  `shift` enum('morning','evening','night') NOT NULL DEFAULT 'morning',
  `status` enum('scheduled','in_progress','completed') NOT NULL DEFAULT 'scheduled',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `production_schedules_operation_step_id_foreign` (`operation_step_id`),
  KEY `production_schedules_machine_id_foreign` (`machine_id`),
  CONSTRAINT `production_schedules_machine_id_foreign` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_schedules_operation_step_id_foreign` FOREIGN KEY (`operation_step_id`) REFERENCES `operation_steps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_schedules`
--

LOCK TABLES `production_schedules` WRITE;
/*!40000 ALTER TABLE `production_schedules` DISABLE KEYS */;
INSERT INTO `production_schedules` VALUES (1,1,1,'2026-04-03','morning','completed','2026-04-02 08:57:42','2026-04-02 08:57:42'),(2,2,1,'2026-04-04','morning','completed','2026-04-02 08:57:43','2026-04-02 08:57:43'),(3,3,4,'2026-04-05','morning','scheduled','2026-04-02 08:57:43','2026-04-02 08:57:43'),(4,4,1,'2026-04-06','morning','scheduled','2026-04-02 08:57:43','2026-04-02 08:57:43'),(5,5,15,'2026-04-07','morning','scheduled','2026-04-02 08:57:44','2026-04-02 08:57:44');
/*!40000 ALTER TABLE `production_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `unit` varchar(255) NOT NULL DEFAULT 'pcs',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'Gear Shaft (Standard)','GS-001','Standard gear shaft for railway wagon application, Material: EN24 Steel','pcs','2026-04-02 08:57:40','2026-04-02 08:57:40'),(2,'Flange (Heavy Duty)','FL-002','Heavy duty flange for pipeline connection, Material: Carbon Steel A105','pcs','2026-04-02 08:57:40','2026-04-02 08:57:40'),(3,'Bush (Phosphor Bronze)','BS-003','Phosphor bronze bush for bearing application','pcs','2026-04-02 08:57:41','2026-04-02 08:57:41'),(4,'Bracket (Engine Mount)','BK-004','Engine mounting bracket, Material: MS Plate','pcs','2026-04-02 08:57:41','2026-04-02 08:57:41'),(5,'Pulley Wheel (V-Belt)','PW-005','Cast iron V-belt pulley wheel, 200mm diameter','pcs','2026-04-02 08:57:41','2026-04-02 08:57:41');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `proof_of_deliveries`
--

DROP TABLE IF EXISTS `proof_of_deliveries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `proof_of_deliveries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `delivery_order_id` bigint(20) unsigned NOT NULL,
  `received_by` varchar(255) DEFAULT NULL,
  `proof_type` enum('signature','photo') NOT NULL DEFAULT 'photo',
  `proof_path` varchar(255) DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `proof_of_deliveries_delivery_order_id_foreign` (`delivery_order_id`),
  CONSTRAINT `proof_of_deliveries_delivery_order_id_foreign` FOREIGN KEY (`delivery_order_id`) REFERENCES `delivery_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `proof_of_deliveries`
--

LOCK TABLES `proof_of_deliveries` WRITE;
/*!40000 ALTER TABLE `proof_of_deliveries` DISABLE KEYS */;
/*!40000 ALTER TABLE `proof_of_deliveries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qc_checklist_items`
--

DROP TABLE IF EXISTS `qc_checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `qc_checklist_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `qc_inspection_id` bigint(20) unsigned NOT NULL,
  `check_description` varchar(255) NOT NULL,
  `measurement` varchar(255) DEFAULT NULL,
  `tolerance` varchar(255) DEFAULT NULL,
  `result` enum('pass','fail') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `qc_checklist_items_qc_inspection_id_foreign` (`qc_inspection_id`),
  CONSTRAINT `qc_checklist_items_qc_inspection_id_foreign` FOREIGN KEY (`qc_inspection_id`) REFERENCES `qc_inspections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qc_checklist_items`
--

LOCK TABLES `qc_checklist_items` WRITE;
/*!40000 ALTER TABLE `qc_checklist_items` DISABLE KEYS */;
INSERT INTO `qc_checklist_items` VALUES (1,1,'OD measurement','200.3mm','200±0.1mm','fail','2026-04-02 08:57:45','2026-04-02 08:57:45'),(2,1,'Face flatness','0.05mm','0.1mm max','pass','2026-04-02 08:57:45','2026-04-02 08:57:45'),(3,1,'Bolt holes PCD','160.0mm','160±0.05mm','pass','2026-04-02 08:57:45','2026-04-02 08:57:45');
/*!40000 ALTER TABLE `qc_checklist_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qc_inspections`
--

DROP TABLE IF EXISTS `qc_inspections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `qc_inspections` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `work_order_id` bigint(20) unsigned NOT NULL,
  `operation_step_id` bigint(20) unsigned DEFAULT NULL,
  `inspector_id` bigint(20) unsigned NOT NULL,
  `result` enum('pass','fail','pending') NOT NULL DEFAULT 'pending',
  `inspection_date` date NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `qc_inspections_work_order_id_foreign` (`work_order_id`),
  KEY `qc_inspections_operation_step_id_foreign` (`operation_step_id`),
  KEY `qc_inspections_inspector_id_foreign` (`inspector_id`),
  CONSTRAINT `qc_inspections_inspector_id_foreign` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qc_inspections_operation_step_id_foreign` FOREIGN KEY (`operation_step_id`) REFERENCES `operation_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `qc_inspections_work_order_id_foreign` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qc_inspections`
--

LOCK TABLES `qc_inspections` WRITE;
/*!40000 ALTER TABLE `qc_inspections` DISABLE KEYS */;
INSERT INTO `qc_inspections` VALUES (1,2,6,5,'fail','2026-04-02','Dimensional non-conformance detected on flange face. OD 0.3mm oversize.','2026-04-02 08:57:45','2026-04-02 08:57:45');
/*!40000 ALTER TABLE `qc_inspections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotation_approvals`
--

DROP TABLE IF EXISTS `quotation_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quotation_approvals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `quotation_id` bigint(20) unsigned NOT NULL,
  `approver_id` bigint(20) unsigned NOT NULL,
  `level` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `remarks` text DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `quotation_approvals_quotation_id_foreign` (`quotation_id`),
  KEY `quotation_approvals_approver_id_foreign` (`approver_id`),
  CONSTRAINT `quotation_approvals_approver_id_foreign` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quotation_approvals_quotation_id_foreign` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation_approvals`
--

LOCK TABLES `quotation_approvals` WRITE;
/*!40000 ALTER TABLE `quotation_approvals` DISABLE KEYS */;
INSERT INTO `quotation_approvals` VALUES (1,1,2,1,'approved','Approved — cost within budget. Proceed with production.','2026-03-28 08:57:42','2026-04-02 08:57:42','2026-04-02 08:57:42');
/*!40000 ALTER TABLE `quotation_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotation_items`
--

DROP TABLE IF EXISTS `quotation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quotation_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `quotation_id` bigint(20) unsigned NOT NULL,
  `description` varchar(255) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `quotation_items_quotation_id_foreign` (`quotation_id`),
  CONSTRAINT `quotation_items_quotation_id_foreign` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotation_items`
--

LOCK TABLES `quotation_items` WRITE;
/*!40000 ALTER TABLE `quotation_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `quotation_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quotations`
--

DROP TABLE IF EXISTS `quotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quotations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `rfq_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `material_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `labour_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `overhead_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `profit_margin` decimal(5,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `vat_rate` decimal(5,2) NOT NULL DEFAULT 15.00,
  `vat_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `validity_days` int(11) NOT NULL DEFAULT 30,
  `notes` text DEFAULT NULL,
  `status` enum('draft','pending_approval','approved','rejected','converted') NOT NULL DEFAULT 'draft',
  `created_by` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `quotations_rfq_id_foreign` (`rfq_id`),
  KEY `quotations_customer_id_foreign` (`customer_id`),
  KEY `quotations_created_by_foreign` (`created_by`),
  CONSTRAINT `quotations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quotations_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quotations_rfq_id_foreign` FOREIGN KEY (`rfq_id`) REFERENCES `rfqs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quotations`
--

LOCK TABLES `quotations` WRITE;
/*!40000 ALTER TABLE `quotations` DISABLE KEYS */;
INSERT INTO `quotations` VALUES (1,1,1,1,180000.00,85000.00,45000.00,15.00,10000.00,15.00,51750.00,398250.00,30,'Price valid for 30 days. Delivery within 45 days of order confirmation.','converted',9,'2026-04-02 08:57:42','2026-04-02 08:57:42');
/*!40000 ALTER TABLE `quotations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rework_orders`
--

DROP TABLE IF EXISTS `rework_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rework_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ncr_id` bigint(20) unsigned NOT NULL,
  `original_work_order_id` bigint(20) unsigned NOT NULL,
  `rework_wo_number` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'open',
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rework_orders_rework_wo_number_unique` (`rework_wo_number`),
  KEY `rework_orders_ncr_id_foreign` (`ncr_id`),
  KEY `rework_orders_original_work_order_id_foreign` (`original_work_order_id`),
  KEY `rework_orders_created_by_foreign` (`created_by`),
  CONSTRAINT `rework_orders_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rework_orders_ncr_id_foreign` FOREIGN KEY (`ncr_id`) REFERENCES `ncrs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rework_orders_original_work_order_id_foreign` FOREIGN KEY (`original_work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rework_orders`
--

LOCK TABLES `rework_orders` WRITE;
/*!40000 ALTER TABLE `rework_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `rework_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rfqs`
--

DROP TABLE IF EXISTS `rfqs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rfqs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `required_by` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('pending','quoted','rejected') NOT NULL DEFAULT 'pending',
  `created_by` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rfqs_customer_id_foreign` (`customer_id`),
  KEY `rfqs_product_id_foreign` (`product_id`),
  KEY `rfqs_created_by_foreign` (`created_by`),
  CONSTRAINT `rfqs_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rfqs_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rfqs_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rfqs`
--

LOCK TABLES `rfqs` WRITE;
/*!40000 ALTER TABLE `rfqs` DISABLE KEYS */;
INSERT INTO `rfqs` VALUES (1,1,1,50.00,'2026-05-17','Urgently required for Q2 maintenance schedule. Standard specification.','quoted',9,'2026-04-02 08:57:42','2026-04-02 08:57:42');
/*!40000 ALTER TABLE `rfqs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_has_permissions`
--

DROP TABLE IF EXISTS `role_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `role_has_permissions_role_id_foreign` (`role_id`),
  CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_has_permissions`
--

LOCK TABLES `role_has_permissions` WRITE;
/*!40000 ALTER TABLE `role_has_permissions` DISABLE KEYS */;
INSERT INTO `role_has_permissions` VALUES (1,2),(1,3),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),(2,2),(2,3),(3,2),(3,9),(4,9),(5,9),(7,2),(7,9),(8,9),(9,9),(10,2),(11,2),(12,2),(13,2),(13,3),(13,5),(13,6),(13,9),(16,2),(17,2),(17,6),(17,8),(18,6),(19,6),(19,8),(20,2),(20,3),(22,3),(23,2),(23,3),(24,3),(25,3),(25,4),(26,4),(27,4),(28,4),(29,2),(29,3),(30,2),(30,3),(30,5),(31,5),(32,5),(33,2),(33,5),(34,2),(37,2),(37,7),(38,7),(39,7),(40,2),(40,3),(40,7),(41,2),(41,7),(42,10),(43,10),(44,10);
/*!40000 ALTER TABLE `role_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'super-admin','web','2026-04-02 08:57:33','2026-04-02 08:57:33'),(2,'management','web','2026-04-02 08:57:33','2026-04-02 08:57:33'),(3,'production-supervisor','web','2026-04-02 08:57:33','2026-04-02 08:57:33'),(4,'machine-operator','web','2026-04-02 08:57:33','2026-04-02 08:57:33'),(5,'qc-inspector','web','2026-04-02 08:57:33','2026-04-02 08:57:33'),(6,'procurement-officer','web','2026-04-02 08:57:34','2026-04-02 08:57:34'),(7,'finance-officer','web','2026-04-02 08:57:34','2026-04-02 08:57:34'),(8,'stores-officer','web','2026-04-02 08:57:34','2026-04-02 08:57:34'),(9,'sales-officer','web','2026-04-02 08:57:34','2026-04-02 08:57:34'),(10,'it-admin','web','2026-04-02 08:57:34','2026-04-02 08:57:34');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'System Admin','admin@bitac.gov.bd',NULL,'$2y$12$hQFFH44yh3R4DVUdyuC5f.X2D/8cxPT0TGFXjn8TnZ/aXgUonknq2',NULL,'2026-04-02 08:57:34','2026-04-02 08:57:34'),(2,'Director General','management@bitac.gov.bd',NULL,'$2y$12$URdoSGcLKV3H.bA57Ku8NemfEEs1Kdfr4KOZOFTknK9psmRYYpZDK',NULL,'2026-04-02 08:57:35','2026-04-02 08:57:35'),(3,'Production Supervisor','supervisor@bitac.gov.bd',NULL,'$2y$12$wEr4w9iEv24v6oMq6fC3juNCgdUbSgIZjbve5PsZvdpTHH7ELaQFK',NULL,'2026-04-02 08:57:35','2026-04-02 08:57:35'),(4,'Machine Operator','operator@bitac.gov.bd',NULL,'$2y$12$Mm4bUbu.xywRZnrqMTYJAOkjADefluuXpnWLkCFR3ARmYyLdPOBPa',NULL,'2026-04-02 08:57:36','2026-04-02 08:57:36'),(5,'QC Inspector','qc@bitac.gov.bd',NULL,'$2y$12$S20iL/09z6oV6BJ884ylB.3e7blxxLLDr1xCrcL8zCV2iCAnYCNvm',NULL,'2026-04-02 08:57:36','2026-04-02 08:57:36'),(6,'Procurement Officer','procurement@bitac.gov.bd',NULL,'$2y$12$g6/Zd.oDIst90yQzV2Gg7uR8MApUT1ByWb6DEFberScWiDWC9JUGe',NULL,'2026-04-02 08:57:36','2026-04-02 08:57:36'),(7,'Finance Officer','finance@bitac.gov.bd',NULL,'$2y$12$marPYns5Slc9vLQCYvCH/OyjOepe62SKk5bAVnMeejR8hjMBgkA8e',NULL,'2026-04-02 08:57:37','2026-04-02 08:57:37'),(8,'Stores Officer','stores@bitac.gov.bd',NULL,'$2y$12$0zcoYLRrNspwtu9sDIKL9Oo9gFvgisE2h7fRjjMtROgUI55czhIhW',NULL,'2026-04-02 08:57:37','2026-04-02 08:57:37'),(9,'Sales Officer','sales@bitac.gov.bd',NULL,'$2y$12$PtI52M0mSdE0DrwGgKGY3efPU26bMHMhJFiAuySoFaLAA1D0P8Bre',NULL,'2026-04-02 08:57:38','2026-04-02 08:57:38'),(10,'IT Admin','it@bitac.gov.bd',NULL,'$2y$12$WDA7M6bOjXZtgVnzH/0bmOxij0qVHbmdVuLmkrjDbM39USCJxp4ge',NULL,'2026-04-02 08:57:38','2026-04-02 08:57:38');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_centres`
--

DROP TABLE IF EXISTS `work_centres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `work_centres` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_centres`
--

LOCK TABLES `work_centres` WRITE;
/*!40000 ALTER TABLE `work_centres` DISABLE KEYS */;
INSERT INTO `work_centres` VALUES (1,'Machine Shop','CNC and conventional machining operations',1,'2026-04-02 08:57:39','2026-04-02 08:57:39'),(2,'Heat Treatment','Heat treatment and hardening processes',1,'2026-04-02 08:57:39','2026-04-02 08:57:39'),(3,'Fabrication','Metal fabrication and forming',1,'2026-04-02 08:57:40','2026-04-02 08:57:40'),(4,'Welding','Welding and joining processes',1,'2026-04-02 08:57:40','2026-04-02 08:57:40'),(5,'Assembly','Final assembly and testing',1,'2026-04-02 08:57:40','2026-04-02 08:57:40');
/*!40000 ALTER TABLE `work_centres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_orders`
--

DROP TABLE IF EXISTS `work_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `work_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `quotation_id` bigint(20) unsigned DEFAULT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `bom_id` bigint(20) unsigned DEFAULT NULL,
  `wo_number` varchar(255) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `status` enum('draft','approved','in_production','qc_hold','qc_passed','ready_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'draft',
  `priority` enum('urgent','normal','low') NOT NULL DEFAULT 'normal',
  `due_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `work_orders_wo_number_unique` (`wo_number`),
  KEY `work_orders_quotation_id_foreign` (`quotation_id`),
  KEY `work_orders_customer_id_foreign` (`customer_id`),
  KEY `work_orders_product_id_foreign` (`product_id`),
  KEY `work_orders_bom_id_foreign` (`bom_id`),
  KEY `work_orders_created_by_foreign` (`created_by`),
  CONSTRAINT `work_orders_bom_id_foreign` FOREIGN KEY (`bom_id`) REFERENCES `boms` (`id`) ON DELETE SET NULL,
  CONSTRAINT `work_orders_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_orders_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_orders_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_orders_quotation_id_foreign` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_orders`
--

LOCK TABLES `work_orders` WRITE;
/*!40000 ALTER TABLE `work_orders` DISABLE KEYS */;
INSERT INTO `work_orders` VALUES (1,1,1,1,1,'WO-2026-0001',50.00,'in_production','normal','2026-05-02','Standard production run. Follow op sheet BITAC-GS-001.',9,'2026-04-02 08:57:42','2026-04-02 08:57:42'),(2,NULL,2,2,2,'WO-2026-0002',20.00,'qc_hold','urgent','2026-04-07','Urgent order for BPDB shutdown maintenance.',9,'2026-04-02 08:57:45','2026-04-02 08:57:45'),(3,NULL,1,3,3,'WO-2026-0003',100.00,'in_production','urgent','2026-03-30','OVERDUE — urgent rescheduling needed.',9,'2026-04-02 08:57:46','2026-04-02 08:57:46');
/*!40000 ALTER TABLE `work_orders` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-02 15:58:54
