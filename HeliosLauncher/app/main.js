const { app, BrowserWindow, ipcMain, autoUpdater } = require('electron')
const path = require('path')
const url = require('url')
const isDev = require('./assets/js/isdev')
const { LoggerUtil } = require('helios-core')
const fetch = require('node-fetch')
const semver = require('semver')

const logger = LoggerUtil.getLogger('Main')

// 업데이트 서버 URL 설정
const updateServer = 'https://github.com/A2kk-Server/A2kk-Launcher-Monorepo'

// 현재 버전 가져오기
const currentVersion = require('../package.json').version

// 자동 업데이트 설정
function setupAutoUpdater(win) {
    if(isDev) {
        return
    }

    // IPC 이벤트 리스너
    ipcMain.on('autoUpdateAction', (event, arg, data) => {
        switch(arg) {
            case 'checkForUpdate':
                win.webContents.send('autoUpdateNotification', 'checking-for-update')
                
                // GitHub API를 통해 최신 릴리즈 버전 확인
                fetch('https://api.github.com/repos/A2kk-Server/A2kk-Launcher-Monorepo/releases/latest')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('GitHub API 요청 실패')
                        }
                        return response.json()
                    })
                    .then(data => {
                        const latestVersion = data.tag_name.replace('v', '')
                        const currentVersion = require('../package.json').version
                        
                        if (semver.gt(latestVersion, currentVersion)) {
                            win.webContents.send('autoUpdateNotification', 'update-available', {
                                version: latestVersion,
                                releaseNotes: data.body || '새로운 업데이트가 있습니다.'
                            })
                        } else {
                            win.webContents.send('autoUpdateNotification', 'update-not-available')
                        }
                    })
                    .catch(err => {
                        console.error('업데이트 확인 중 오류:', err)
                        win.webContents.send('autoUpdateNotification', 'update-not-available')
                    })
                break
            case 'allowPrereleaseChange':
                autoUpdater.allowPrerelease = data
                autoUpdater.checkForUpdates()
                    .catch(err => {
                        win.webContents.send('autoUpdateNotification', 'realerror', {
                            error: err,
                            code: err.code
                        })
                    })
                break
        }
    })

    // 업데이트 이벤트 리스너
    autoUpdater.on('checking-for-update', () => {
        win.webContents.send('autoUpdateNotification', 'checking-for-update')
    })

    autoUpdater.on('update-not-available', () => {
        win.webContents.send('autoUpdateNotification', 'update-not-available')
    })

    autoUpdater.on('error', (err) => {
        win.webContents.send('autoUpdateNotification', 'realerror', {
            error: err,
            code: err.code
        })
    })

    // 초기 업데이트 확인
    win.webContents.once('did-finish-load', () => {
        win.webContents.send('autoUpdateNotification', 'ready')
    })

    // 즉시 업데이트 확인 시작
    autoUpdater.checkForUpdates()
        .catch(err => {
            win.webContents.send('autoUpdateNotification', 'realerror', {
                error: err,
                code: err.code
            })
        })
}

function createWindow() {
    // 브라우저 창 생성
    const win = new BrowserWindow({
        width: 980,
        height: 552,
        icon: getPlatformIcon('SealCircle'),
        frame: false,
        backgroundColor: '#171614',
        show: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    })

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'app.ejs'),
        protocol: 'file:',
        slashes: true
    }))

    win.once('ready-to-show', () => {
        win.show()
    })

    // 자동 업데이트 설정
    setupAutoUpdater(win)

    // ... 나머지 코드는 그대로 유지
}

app.on('ready', () => {
    const win = createWindow()
    createMenu()
    
    // 앱 시작 시 자동 업데이트 설정
    if (!isDev) {
        setupAutoUpdater(win)
        // 30분마다 업데이트 확인
        setInterval(() => {
            autoUpdater.checkForUpdates()
        }, 1800000)
    }
})

// ... 나머지 코드는 그대로 유지