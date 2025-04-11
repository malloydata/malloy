-- SQL Server 2022 dialect version of the PostgreSQL dump

-- Note: PostgreSQL SET commands related to session behavior (timeouts, encoding, etc.)
-- are not directly translated as they are session-specific or handled differently in SQL Server.

-- Create the schema if it doesn't already exist
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'malloytest')
BEGIN
    EXEC('CREATE SCHEMA malloytest');
END
GO

--
-- Name: aircraft_models; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.aircraft_models (
    aircraft_model_code NVARCHAR(MAX),
    manufacturer NVARCHAR(MAX),
    model NVARCHAR(MAX),
    aircraft_type_id INT,
    aircraft_engine_type_id INT,
    aircraft_category_id INT,
    amateur INT,
    engines INT,
    seats INT,
    weight INT,
    speed INT
);
GO

--
-- Name: aircraft; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.aircraft (
    id BIGINT,
    tail_num NVARCHAR(MAX),
    aircraft_serial NVARCHAR(MAX),
    aircraft_model_code NVARCHAR(MAX),
    aircraft_engine_code NVARCHAR(MAX),
    year_built INT,
    aircraft_type_id INT,
    aircraft_engine_type_id INT,
    registrant_type_id INT,
    name NVARCHAR(MAX),
    address1 NVARCHAR(MAX),
    address2 NVARCHAR(MAX),
    city NVARCHAR(MAX),
    state NVARCHAR(MAX),
    zip NVARCHAR(MAX),
    region NVARCHAR(MAX),
    county NVARCHAR(MAX),
    country NVARCHAR(MAX),
    certification NVARCHAR(MAX),
    status_code NVARCHAR(MAX),
    mode_s_code NVARCHAR(MAX),
    fract_owner NVARCHAR(MAX)
    last_action_date NVARCHAR(MAX),
    cert_issue_date NVARCHAR(MAX),
    air_worth_date NVARCHAR(MAX)
);
GO

--
-- Name: airports; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.airports (
    id INT,
    code NVARCHAR(MAX)
    site_number NVARCHAR(MAX),
    fac_type NVARCHAR(MAX),
    fac_use NVARCHAR(MAX),
    faa_region NVARCHAR(MAX)
    faa_dist NVARCHAR(MAX)
    city NVARCHAR(MAX),
    county NVARCHAR(MAX),
    state NVARCHAR(MAX),
    full_name NVARCHAR(MAX),
    own_type NVARCHAR(MAX)
    longitude FLOAT,
    latitude FLOAT,
    elevation INT,
    aero_cht NVARCHAR(MAX),
    cbd_dist INT,
    cbd_dir NVARCHAR(MAX)
    act_date NVARCHAR(MAX),
    cert NVARCHAR(MAX),
    fed_agree NVARCHAR(MAX)
    cust_intl NVARCHAR(MAX)
    c_ldg_rts NVARCHAR(MAX)
    joint_use NVARCHAR(MAX)
    mil_rts NVARCHAR(MAX)
    cntl_twr NVARCHAR(MAX)
    major NVARCHAR(MAX)
);
GO

--
-- Name: alltypes; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.alltypes (
    this_string NVARCHAR(MAX),
    this_int INT,
    this_float FLOAT
);
GO

--
-- Name: carriers; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.carriers (
    code NVARCHAR(MAX),
    name NVARCHAR(MAX),
    nickname NVARCHAR(MAX)
);
GO

--
-- Name: flights; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.flights (
    carrier NVARCHAR(MAX),
    origin NVARCHAR(MAX),
    destination NVARCHAR(MAX),
    flight_num INT,
    flight_time INT,
    tail_num NVARCHAR(MAX),
    dep_time DATETIME2,
    arr_time DATETIME2,
    dep_delay INT,
    arr_delay INT,
    taxi_out INT,
    taxi_in INT,
    distance INT,
    cancelled NVARCHAR(MAX),
    diverted NVARCHAR(MAX),
    id2 INT
);
GO

--
-- Name: order_items; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.order_items (
    id INT,
    order_id INT,
    amount INT,
    sku_num INT
);
GO

--
-- Name: orders; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.orders (
    id INT,
    status NVARCHAR(MAX),
    user_id INT,
    order_amount FLOAT,
    created_at DATETIME2
);
GO

--
-- Name: state_facts; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.state_facts (
    state NVARCHAR(MAX),
    aircraft_count INT,
    airport_count INT,
    births INT,
    popular_name NVARCHAR(MAX)
);
GO

--
-- Name: users; Type: TABLE; Schema: malloytest;
--
CREATE TABLE malloytest.users (
    id INT,
    name NVARCHAR(MAX),
    age INT,
    created_at DATETIME2,
    epoch_at INT,
    yyyymmdd_at INT
);
GO
