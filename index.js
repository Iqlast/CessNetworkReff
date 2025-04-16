const { listEmails, getDomains } = require('mail-genie'); // Updated to use mail-genie's domains
const chalk = require('chalk');
const axios = require('axios');
const prompts = require('prompts');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Config
const SUCCESS_FILE = 'success.txt';
const PROXY_FILE = 'proxy.txt';
const CESS_LOGIN_URL = 'https://cess.network/deshareairdrop';
const MERKLE_API_URL = 'https://merklev2.cess.network/merkle';

// Global variables
let inviteCode = '';
let authToken = '';
let proxyAgent = null;
let referralCount = 1;

// Banner
function showBanner() {
    console.log(chalk.hex('#00FFFF').bold(`

        ██╗  ░██████╗░  ██╗░░░░░  ░█████╗░  ░██████╗  ████████╗
        ██║  ██╔═══██╗  ██║░░░░░  ██╔══██╗  ██╔════╝  ╚══██╔══╝
        ██║  ██║██╗██║  ██║░░░░░  ███████║  ╚█████╗░  ░░░██║░░░
        ██║  ╚██████╔╝  ██║░░░░░  ██╔══██║  ░╚═══██╗  ░░░██║░░░
        ██║  ░╚═██╔═╝░  ███████╗  ██║░░██║  ██████╔╝  ░░░██║░░░
        ╚═╝  ░░░╚═╝░░░  ╚══════╝  ╚═╝░░╚═╝  ╚═════╝░  ░░░╚═╝░░░
    `));
    console.log(chalk.hex('#FFA500')(`
    🔗 Referral Program For : https://cess.network
    🌟 Star me on GitHub: https://github.com/Iqlast
    `));
    console.log(chalk.hex('#FF00FF').bold('='.repeat(60)));
}

// Utility functions
function getCurrentTime() {
    return new Date().toLocaleTimeString("id-ID", { hour12: false });
}

function generateRandomString(length = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function saveSuccess(email) {
    fs.appendFileSync(SUCCESS_FILE, `${email}\n`, 'utf8');
}

function loadProxies() {
    if (!fs.existsSync(PROXY_FILE)) return [];
    return fs.readFileSync(PROXY_FILE, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);
}

function getRandomProxy(proxies) {
    return proxies[Math.floor(Math.random() * proxies.length)];
}

function createProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;
    
    try {
        if (proxyUrl.startsWith('socks')) {
            return new SocksProxyAgent(proxyUrl);
        } else {
            return new HttpsProxyAgent(proxyUrl);
        }
    } catch (e) {
        console.log(chalk.red(`Proxy error: ${e.message}`));
        return null;
    }
}

// Core functions
async function waitForEmail(email) {
    let waitingTime = 0;
    console.log(chalk.yellow(`⏳ [${getCurrentTime()}] Waiting for verification email...`));
    
    const interval = setInterval(() => {
        waitingTime++;
        process.stdout.write(chalk.gray(`⏱️ ${waitingTime}s waiting...\r`));
    }, 1000);

    try {
        while (true) {
            const emails = await listEmails(email);
            if (emails.length > 0) {
                clearInterval(interval);
                console.log(chalk.green(`\n✅ Email received (${waitingTime}s)`));
                return emails[0];
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        clearInterval(interval);
        console.log(chalk.red(`\n❌ Email error: ${error.message}`));
        return null;
    }
}

async function makeRequest(url, data, headers = {}) {
    const config = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Content-Type': 'application/json',
            ...headers
        },
        httpsAgent: proxyAgent,
        timeout: 10000
    };

    try {
        const response = await axios.post(url, data, config);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
}

async function registerEmail(email) {
    return await makeRequest(
        `${MERKLE_API_URL}/ecode`,
        { email }
    );
}

async function loginWithCode(email, code) {
    const result = await makeRequest(
        `${MERKLE_API_URL}/elogin`,
        { email, code }
    );
    
    if (result?.code === 200) {
        authToken = result.data;
        return true;
    }
    return false;
}

async function submitInvite() {
    if (!inviteCode) return;
    
    return await makeRequest(
        `${MERKLE_API_URL}/task/invite`,
        { code: inviteCode },
        { 'token': authToken }
    );
}

function extractCode(emailBody) {
    const code = emailBody.match(/\b\d{6}\b/)?.[0];
    if (!code) throw new Error('No verification code found');
    return code;
}

// Main flow
async function createAccount() {
    try {
        // Get random domain from mail-genie
        const domains = await getDomains();
        if (domains.length === 0) throw new Error('No domains available');
        const randomDomain = domains[Math.floor(Math.random() * domains.length)];
        
        // Generate random email
        const randomEmail = `${generateRandomString(12)}@${randomDomain}`;
        console.log(chalk.magenta(`📧 Email: ${randomEmail}`));

        // Register email
        await registerEmail(randomEmail);
        console.log(chalk.blue('📝 Registration successful'));

        // Get verification code
        const emailData = await waitForEmail(randomEmail);
        const verificationCode = extractCode(emailData.body.plaintext);
        console.log(chalk.cyan(`🔑 Code: ${verificationCode}`));

        // Login
        await loginWithCode(randomEmail, verificationCode);
        console.log(chalk.green('🔓 Login successful'));

        // Submit invite if available
        if (inviteCode) {
            await submitInvite();
            console.log(chalk.green('🎯 Invite submitted'));
        }

        // Save to file
        saveSuccess(randomEmail);
        return true;

    } catch (error) {
        console.log(chalk.red(`❌ Error: ${error}`));
        return false;
    }
}

async function main() {
    showBanner();

    // Get user input
    const { useProxy } = await prompts({
        type: 'confirm',
        name: 'useProxy',
        message: 'Use proxy?',
        initial: false
    });

    if (useProxy) {
        const proxies = loadProxies();
        if (proxies.length > 0) {
            proxyAgent = createProxyAgent(getRandomProxy(proxies));
            console.log(chalk.green('🌐 Using proxy'));
        } else {
            console.log(chalk.yellow('⚠️ No proxies found in proxy.txt'));
        }
    }

    const { code } = await prompts({
        type: 'text',
        name: 'code',
        message: 'Enter invite code :'
    });
    inviteCode = code;

    const { count } = await prompts({
        type: 'number',
        name: 'count',
        message: 'How many accounts to create?',
        initial: 1,
        min: 1
    });

    // Create accounts
    console.log(chalk.blue.bold(`\nCreating ${count} account(s)...`));
    let successCount = 0;
    
    for (let i = 0; i < count; i++) {
        console.log(chalk.blue.bold(`\nAccount ${i + 1}/${count}`));
        if (await createAccount()) successCount++;
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final message
    console.log(chalk.green.bold(`\n✅ Successfully created ${successCount} account(s)`));
    console.log(chalk.blue.bold(`
    TO ACCESS YOUR ACCOUNTS:1. Go to https://cess.network/deshareairdrop/login
    2. Use email from success.txt
    3. Check verification code at 
       https://generator.email/example@mail.com <-- use email from succes.txt
    4. Login with the code
    `));
}

main().catch(console.error);