import {SqlServerConnection, SqlServerExecutor} from './sqlserver_connection';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config: sql.config = {
  user: 'sa',
  password: 'saTEST_0pword',
  server: 'localhost',
  port: 1433,
  database: 'banana',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function testOwnConnection() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT @@VERSION AS version');
    console.log('Connected! SQL Server version:', result.recordset[0].version);
    await pool.close();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

async function testMalloyConnection() {
  const conn = new SqlServerConnection(
    'sqlserver',
    {},
    SqlServerExecutor.getConnectionOptionsFromEnv()
  );

  const resGen = conn.runSQLStream('SELECT 1');
  console.log(resGen);
  const res1 = await resGen.next();
  console.log(res1);
  const res2 = await resGen.next();
  console.log(res2);
}

(async () => {
  await testOwnConnection();
  console.log('ok');
  console.log( process.env);
  console.log( SqlServerExecutor.getConnectionOptionsFromEnv());
  await testMalloyConnection();
})();
