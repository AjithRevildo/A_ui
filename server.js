// import required modules and libraries
const { exec } = require('child_process');
const express = require('express');
const app = express();
const axios = require('axios');
const os = require('os');
const network = require('network');
const { spawn } = require('child_process');





// enable CORS for requests coming from http://localhost:3000
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});



const urls = [
  { name: 'Med Mandra(Integrated)', url: 'http://his-chn.apollohospitals.com:8383/' },
  { name: 'Med Mandra(101)', url: 'http://10.44.6.101:8383' },
  { name: 'Med Mandra(102)', url: 'http://10.44.6.102:8383' },
  { name: 'Med Mandra(103)', url: 'http://10.44.6.103:8383' },
  { name: 'Med Mandra(104)', url: 'http://10.44.6.104:8383' },
  { name: 'Med Mandra(105)', url: 'http://10.44.6.105:8383' },
  { name: 'Med Mandra(New Emr)', url: 'https://opservices.apollohospitals.com'},
  { name: 'New Digital Hospital', url: 'http://10.44.6.113:9893/index.html'},
  { name: 'AHC Summary', url: 'https://ahcsummary.apollohospitals.com/Login'},
  { name: 'PACS', url: 'http://10.44.80.67/PACSLogin'},
  { name: 'Office365', url: 'https://outlook.office.com'},
];

// Function to check URLs
async function checkUrls() {
    let results = [];
    for (const { name, url } of urls) {
      try {
        const response = await axios.get(url, { timeout: 5000 });
        results.push({ name, url, status: 'UP', statusCode: response.status });
      } catch (error) {
        if (error.code === 'ETIMEDOUT') {
          results.push({ name, url, status: 'DOWN', error: 'Request timed out.' });
        } else if (error.response) {
          results.push({ name, url, status: 'DOWN', error: `Status code ${error.response.status}` });
        } else {
          results.push({ name, url, status: 'DOWN', error: error.message });
        }
      }
    }
    return {
      results,
      timestamp: new Date().toLocaleString(),
    };
  }
  

// Endpoint to get the status of URLs
app.get('/checkUrls', async (req, res) => {
    const { results, timestamp } = await checkUrls();
    //console.log(`URL status updated: ${timestamp}`);
    res.json({ results, timestamp });
  });

// Continuously check URLs every 5 seconds
setInterval(async () => {
  const results = await checkUrls();
  //console.log(`URL status updated: ${new Date().toLocaleString()}`);
}, 5000);

// define a variable to hold system information
const systemInfo = {
  brand: os.cpus()[0].model.split(' ')[0],
  model: os.hostname(),
  ramType: os.type(),
  ramSize: `${(os.totalmem() / (1024 ** 3)).toFixed(2)}GB`,
  ramUsage: `${((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(2)}GB`,
  totalStorage: `${(os.totalmem() / (1024 ** 3)).toFixed(2)}GB`,
  freeStorage: `${(os.freemem() / (1024 ** 3)).toFixed(2)}GB`,
  usedStorage: `${((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(2)}GB`,
  processorModel: os.cpus()[0].model,
  processorSpeed: os.cpus()[0].speed,
  osName: os.type(),
  osVersion: os.release(),
  cpuUsage: Math.round(os.loadavg()[0] * 100) / 100,
  userName: os.userInfo().username,
  osBitType: os.arch()
};

// handle GET requests for system information endpoint
app.get('/api/system-info', (req, res) => {
  res.json(systemInfo);
});

// handle GET requests for network information endpoint
app.get('/api/network-info', async (req, res) => {
  try {
    const networkInfo = {};

    // Retrieve the IP address and subnet mask
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach((iface) => {
      interfaces[iface].forEach((address) => {
        if (address.family === 'IPv4' && !address.internal) {
          networkInfo.ipAddress = address.address;
          networkInfo.subnetMask = address.netmask;
        }
      });
    });

    // Retrieve the default gateway
    const ip = await new Promise((resolve, reject) => {
      network.get_gateway_ip((error, ip) => {
        if (error) {
          reject(error);
        } else {
          resolve(ip);
        }
      });
    });
    networkInfo.gateway = ip;

    // Ping the IP address
    const pingResult = await new Promise((resolve, reject) => {
      exec(`ping ${networkInfo.ipAddress}`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });

    // send the result back as json
    res.json({
      ...networkInfo,
      pingResult
    });
  } catch (error) {
    console.error(error);

    // handle errors gracefully
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.get('/api/ping', async (req, res) => {

 
 const ipAddressPrefix = '10.44.95.';
const ipAddresses = [];

for (let i = 1; i <= 254; i++) {
  ipAddresses.push(ipAddressPrefix + i);
}

const pingIps = async () => {
  // Check if there are any IP addresses to ping
  if (!ipAddresses || ipAddresses.length === 0) {
    console.error('No IP addresses found to ping');
    return { error: 'No IP addresses found to ping' };
  }

  const pingPromises = ipAddresses.map((ip) => {
    return new Promise((resolve, reject) => {
      const ping = spawn('ping', ['-c', '1', ip]);
      let commandOutput = '';
      ping.on('close', (code) => {
        if (code === 0) {
          // Resolve with a successful ping object
          resolve({ ip, status: 'success', output: commandOutput });
        } else {
          // Resolve with an unsuccessful ping object
          resolve({ ip, status: 'fail', error: `Ping failed with code ${code}` });
        }
      });
      ping.on('error', (error) => {
        // Reject with an error ping object
        reject({ ip, status: 'error', error: error.message });
      });
      ping.stdout.on('data', (data) => {
        commandOutput += data.toString();
      });
    });
  });

  try {
    const results = await Promise.allSettled(pingPromises);
    const successfulPings = results.filter((result) => result.status === 'fulfilled' && result.value.status === 'success').map((result) => ({ ...result.value }));
    const unsuccessfulPings = results.filter((result) => result.status === 'fulfilled' && result.value.status !== 'success').map((result) => ({ ...result.value }));
    console.log('Successful pings:', successfulPings);
    console.log('Unsuccessful pings:', unsuccessfulPings);
    return { successfulPings, unsuccessfulPings };
  } catch (error) {
    console.error('Error pinging IPs:', error);
    return { error: error.message };
  }
};
  try {
    const result = await pingIps();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// set up server to listen on a specific port
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server is listening on port ${port}...`));
