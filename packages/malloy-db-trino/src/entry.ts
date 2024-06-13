import {Client} from 'presto-client';

async function doRun(): Promise<void> {
  console.log('IM DOING STUFF');
  const client = new Client({
    catalog: 'prism',
    schema: 'infrastructure',
    user: 'arreola222',
    ssl: {
      ca: 'CorpCA',
      //cert: '/var/facebook/credentials/arreola/presto/arreola.pem',
      cert: `<CERT CONTENT>`,
    },
    //source: 'presto-client-js-test',
    host: 'proxy.presto.fbinfra.net',
    port: 7778,
    timeout: 60000,
  });
  try {
    console.log('running query');
    await client.execute({
      query: 'SELECT * FROM dim_public_tasks limit 1;',
      success: (error, stats, info) => {
        console.log(
          `SUCCESS: error ${JSON.stringify(error)} stats ${JSON.stringify(
            stats
          )} info ${JSON.stringify(info)}`
        );
      },
      error(error) {
        console.log(`ERROR: ${JSON.stringify(error)}`);
      },
    });
  } catch (e) {
    console.log(e);
  }
}

doRun();
