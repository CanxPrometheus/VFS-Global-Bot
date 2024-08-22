const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getUsers: (message) => ipcRenderer.send('getUsers', message),
    sendUserList: (callback) => ipcRenderer.on('sendUserList', (event, response) => callback(response)),
    

    selectUser: (message) => ipcRenderer.send('selectUser', message),
    sendUserDatatoLeft: (callback) => ipcRenderer.on('sendUserDatatoLeft', (event, response) => callback(response)),

    deleteCustomer: (message) => ipcRenderer.send('deleteCustomer', message),
    userDeleted: (callback) => ipcRenderer.on('userDeleted', (event, response) => callback(response)),

    deleteAllCustomer: (message) => ipcRenderer.send('deleteAllCustomer', message),
    allUsersDeleted: (callback) => ipcRenderer.on('allUsersDeleted', (event, response) => callback(response)),

    CreateProcess: (message) => ipcRenderer.send('CreateProcess', message),
    getAllQueue: (message) => ipcRenderer.send('getAllQueue', message),
    DeleteProcess: (message) => ipcRenderer.send('DeleteProcess', message),
    sendQueueList: (callback) => ipcRenderer.on('sendQueueList', (event, response) => callback(response)),
    
    createUser: (message) => ipcRenderer.send('createUser', message),
    // userDeleted: (callback) => ipcRenderer.on('userDeleted', (event, response) => callback(response)),
    
    
    getPaymentMethods: (message) => ipcRenderer.send('getPaymentMethods', message),
    sendPaymentMethods: (callback) => ipcRenderer.on('sendPaymentMethods', (event, response) => callback(response)),
});