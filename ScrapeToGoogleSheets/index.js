const cron = require('node-cron');
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';


// Schedule tasks to be run on the server 
// 
//
// To run on server, run pm2 start index.js --watch --name cron_job_name in this directory
//
//
// cron.schedule('* * * * *', function () { // running every day at midnight (see https://crontab.guru/every-8-hours)

    // Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Sheets API.
        authorize(JSON.parse(content), writeData);
    });
// });


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

async function writeData(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    let values = [];
    let row = [];

    let dateObject = new Date();
    row.push(dateObject.toDateString())
    let resp = await scrapeURL('https://workspace.google.com/marketplace/app/flashcard_lab/934660656831');
    if (resp.success) {
        row.push(resp.downloadCount);
    }
    else row.push('');

    values = [row];
    const resource = {
        values,
    };
    sheets.spreadsheets.values.append(
        {
            spreadsheetId: '1Q5PkIgbXd49pMfhxv3-0TER37AO1r75T99k_wb8EaCk',
            range: 'Sheet1!A2',
            valueInputOption: 'RAW',
            resource: resource,
        },
        (err, result) => {
            if (err) {
                // Handle error
                console.log(err);
            } else {
                // console.log('successful append to google sheets')
            }
        }
    );
}


// Main scrape function 
async function scrapeURL(gwsStoreLisingURL) {
    // Modify this to make your own scrape function
    try {
        const downloadCount = await getDownloadCount(gwsStoreLisingURL);
        return {
            success: true,
            downloadCount,
        }
    }
    catch (e) {
        console.log(e)
        return {
            success: false,
        };
    }

}

async function getDownloadCount(gswStoreLisingURL) {
    try {
        const responseGSWListingPage = await fetch(gswStoreLisingURL);

        // using await to ensure that the promise resolves
        let body = await responseGSWListingPage.text();
        return parseHTML(body); 
    } catch (error) {
        console.log(error.message)
        return 0;
    }
}

function parseHTML(body) {
    try {
        // parse the html text
        const $ = cheerio.load(body);
        let downloadCount = $("*[itemprop = 'aggregateRating']").next().next().text();
        downloadCount = downloadCount.replace(',', '');
        if (isNaN(parseFloat(downloadCount))) downloadCount = '0';
        return parseInt(downloadCount);
    } catch (error) {
        console.log(error.message)
        return 0;
    }
}