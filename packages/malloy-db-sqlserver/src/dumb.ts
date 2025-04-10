import {SqlServerConnection} from './sqlserver_connection';
import sql from 'mssql';

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
  const connectionString =
    'Server=localhost;Database=banana;User Id=sa;Password=saTEST_0pword;Encrypt=True;TrustServerCertificate=True;';
  const conn = new SqlServerConnection({
    name: 'test-sqlserver',
    connectionString,
  });

  const resGen = conn.runSQLStream('SELECT 1');
  console.log(resGen);
  const res1 = await resGen.next();
  console.log(res1);
  const res2 = await resGen.next();
  console.log(res2);
}

(async () => {
  await testOwnConnection();
  await testMalloyConnection();
})();
