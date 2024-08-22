const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { ExecuteSql } = require("./db");
const puppeteer = require("./puppeteer");

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, 'images/logo.png')
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Geliştirici konsolunu aç
    Menu.setApplicationMenu(null);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('getUsers', async function(event, message) {
    const query = await ExecuteSql("SELECT * FROM customers");
    return event.sender.send('sendUserList', {status: true, users: query});
});

ipcMain.on('selectUser', async function(event, message) {
    const query = await ExecuteSql("SELECT * FROM customers WHERE id = ?", [message]);
    if (!query[0]) {
        return event.sender.send('sendUserDatatoLeft', {status: false, message: "Kullanıcı bulunamadı!"});
    }
    return event.sender.send('sendUserDatatoLeft', {status: true, user: query[0], message: "Kullanıcı başarıyla getirildi!"});
});

ipcMain.on('createUser', async (event, message) => {
    const {name, lastname, gender, birth_date, nationality, passport_number, passport_expiry, area_code, phone_number, email} = JSON.parse(message);
    try {
        await ExecuteSql("INSERT INTO customers (name, lastname, gender, birth_date, nationality, passport_number, passport_expiry, area_code, phone_number, email) VALUES (?,?,?,?,?,?,?,?,?,?)", [name, lastname, gender, birth_date, nationality, passport_number, passport_expiry, area_code, phone_number, email]);
        const query = await ExecuteSql("SELECT * FROM customers");
        event.sender.send('sendUserList', { status: true, users: query });
        event.sender.send('userDeleted', { status: true, message: "Kullanıcı başarıyla silindi!" });
    } catch (err) {
        event.sender.send('userDeleted', { status: false, message: err.message });
    }
});

ipcMain.on('deleteCustomer', async (event, id) => {
    try {
        const userQuery = await ExecuteSql("SELECT * FROM customers WHERE id = ?", [id]);
        if (userQuery.length === 0) {
            return event.sender.send('userDeleted', { status: false, message: "BÖYLE BİR KULLANICI YOK!" });
        }
        await ExecuteSql("DELETE FROM customers WHERE id = ?", [id]);
        const query = await ExecuteSql("SELECT * FROM customers");
        event.sender.send('sendUserList', { status: true, users: query });
        event.sender.send('userDeleted', { status: true, message: "Kullanıcı başarıyla silindi!" });
    } catch (err) {
        event.sender.send('userDeleted', { status: false, message: err.message });
    }
});


ipcMain.on('deleteAllCustomer', async (event) => {
    try {
        await ExecuteSql("DELETE FROM customers");
        const query = await ExecuteSql("SELECT * FROM customers");
        event.sender.send('sendUserList', {status: true, users: query});
        event.sender.send('allUsersDeleted', { status: true, message: "Tüm Kullanıcılar Silindi" });
    } catch (err) {
        event.sender.send('allUsersDeleted', { status: false, message: "Silinecek Kullanıcı Bulunamadı" });
    }
});

ipcMain.on('CreateProcess', async (event, message) => {
    const { customerids, details } = JSON.parse(message);

    try {
        await ExecuteSql("INSERT INTO queue (customers, visadetails) VALUES (?, ?)", [JSON.stringify(customerids), JSON.stringify(details)]);
        const newqueue = await getQueueList();
        event.sender.send('sendQueueList', { status: true, data: newqueue});
        event.sender.send('allUsersDeleted', { status: true, message: "Başarıyla işlem oluşturuldu!" });
    } catch (err) {
        event.sender.send('allUsersDeleted', { status: false, message: "Sıraya eklenirken hata oluştu" });
    }
});

ipcMain.on('DeleteProcess', async (event, id) => {
    try {
        await ExecuteSql("DELETE FROM queue WHERE id=?", [id]);
        const newqueue = await getQueueList();
        event.sender.send('sendQueueList', { status: true, data: newqueue});
        event.sender.send('allUsersDeleted', { status: true, message: "Başarıyla işlem silindi!" });
    } catch (err) {
        event.sender.send('allUsersDeleted', { status: false, message: "Sıraya eklenirken hata oluştu" });
    }
});

ipcMain.on('getAllQueue', async (event, message) => {
    try {
        const newqueue = await getQueueList();
        console.log(newqueue);
        event.sender.send('sendQueueList', { status: true, data: newqueue});
    } catch (err) {
        event.sender.send('allUsersDeleted', { status: false, message: "Sıraya getirilirken hata oluştu!" });
    }
});

const {ODEME_BILGILERI} = require("./config.json");
ipcMain.on('getPaymentMethods', async (event, message) => {
    try {
        event.sender.send('sendPaymentMethods', { status: true, data: ODEME_BILGILERI});
    } catch (err) {
        event.sender.send('sendPaymentMethods', { status: false, message: "Ödeme bilgileri getirilirken bir hata oluştu!" });
    }
});



async function getQueueList() {
    const rawQueue = await ExecuteSql("SELECT * FROM queue ORDER BY id ASC");
    let queue = [];
    for (const queueItem of rawQueue) {
        const details = JSON.parse(queueItem.visadetails);
        const customers = JSON.parse(queueItem.customers);
        let nowqu = {
            id: queueItem.id,
            persons: [

            ],
            details: {
                basvurumerkezi: details.basvurumerkezi,
                basvurukategori: details.basvurukategori
            }
        }
        for (const customerId of customers) {
            const user = await ExecuteSql("SELECT * FROM customers WHERE id = ?", [customerId]);
            nowqu.persons.push(user[0]);
        }
        queue.push(nowqu);
    }
    return queue;
}