/**
 * Core UI functions are initialized in this file. This prevents
 * unexpected errors from breaking the core features. Specifically,
 * actions in this file should not require the usage of any internal
 * modules, excluding dependencies.
 */
// Requirements
const $                              = require('jquery')
const {ipcRenderer, shell, webFrame} = require('electron')
const remote                         = require('@electron/remote')
const isDev                          = require('./assets/js/isdev')
const { LoggerUtil }                 = require('helios-core')
const Lang                           = require('./assets/js/langloader')

const loggerUICore             = LoggerUtil.getLogger('UICore')
const loggerAutoUpdater        = LoggerUtil.getLogger('AutoUpdater')

// Log deprecation and process warnings.
process.traceProcessWarnings = true
process.traceDeprecation = true

// Disable eval function.
// eslint-disable-next-line
window.eval = global.eval = function () {
    throw new Error('Sorry, this app does not support window.eval().')
}

// Display warning when devtools window is opened.
remote.getCurrentWebContents().on('devtools-opened', () => {
    console.log('%cThe console is dark and full of terrors.', 'color: white; -webkit-text-stroke: 4px #a02d2a; font-size: 60px; font-weight: bold')
    console.log('%cIf you\'ve been told to paste something here, you\'re being scammed.', 'font-size: 16px')
    console.log('%cUnless you know exactly what you\'re doing, close this window.', 'font-size: 16px')
})

// Disable zoom, needed for darwin.
webFrame.setZoomLevel(0)
webFrame.setVisualZoomLevelLimits(1, 1)

// Initialize auto updates in production environments.
if(!isDev){
    // 앱 시작 시 바로 업데이트 확인
    ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
    
    ipcRenderer.on('autoUpdateNotification', (event, arg, info) => {
        switch(arg){
            case 'checking-for-update':
                loggerAutoUpdater.info('업데이트 확인 중..')
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkingForUpdateButton'), true)
                break
            case 'update-available':
                loggerAutoUpdater.info('새 업데이트 발견:', info.version)
                
                if(process.platform === 'darwin'){
                    showUpdatePopup(info.version)
                }
                
                populateSettingsUpdateInformation(info)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkForUpdatesButton'), false)
                break
            case 'update-not-available':
                loggerAutoUpdater.info('새 업데이트가 없습니다.')
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkForUpdatesButton'), false)
                // 업데이트 없음 알림 표시
                setOverlayContent(
                    '업데이트 확인',
                    '현재 최신 버전을 사용 중입니다.',
                    '확인'
                )
                setOverlayHandler(() => {
                    toggleOverlay(false)
                })
                toggleOverlay(true)
                break
            case 'ready':
                updateCheckListener = setInterval(() => {
                    ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                }, 1800000)
                ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                break
            case 'realerror':
                if(info != null && info.code != null){
                    if(info.code === 'ERR_UPDATER_INVALID_RELEASE_FEED'){
                        loggerAutoUpdater.info('적합한 릴리즈를 찾을 수 없습니다.')
                    } else if(info.code === 'ERR_XML_MISSED_ELEMENT'){
                        loggerAutoUpdater.info('릴리즈를 찾을 수 없습니다.')
                    } else {
                        loggerAutoUpdater.error('업데이트 확인 중 오류 발생:', info)
                        loggerAutoUpdater.debug('오류 코드:', info.code)
                    }
                }
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkForUpdatesButton'), false)
                break
            default:
                loggerAutoUpdater.info('알 수 없는 인자:', arg)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkForUpdatesButton'), false)
                break
        }
    })
}

/**
 * Send a notification to the main process changing the value of
 * allowPrerelease. If we are running a prerelease version, then
 * this will always be set to true, regardless of the current value
 * of val.
 * 
 * @param {boolean} val The new allow prerelease value.
 */
function changeAllowPrerelease(val){
    ipcRenderer.send('autoUpdateAction', 'allowPrereleaseChange', val)
}

function showUpdateUI(info){
    //TODO Make this message a bit more informative `${info.version}`
    document.getElementById('image_seal_container').setAttribute('update', true)
    document.getElementById('image_seal_container').onclick = () => {
        /*setOverlayContent('Update Available', 'A new update for the launcher is available. Would you like to install now?', 'Install', 'Later')
        setOverlayHandler(() => {
            if(!isDev){
                ipcRenderer.send('autoUpdateAction', 'installUpdateNow')
            } else {
                console.error('Cannot install updates in development environment.')
                toggleOverlay(false)
            }
        })
        setDismissHandler(() => {
            toggleOverlay(false)
        })
        toggleOverlay(true, true)*/
        switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
            settingsNavItemListener(document.getElementById('settingsNavUpdate'), false)
        })
    }
}

// 업데이트 사용 가능 표시
function showUpdateAvailable() {
    const container = document.getElementById('updateAvailableContainer')
    if (container) {
        container.style.display = 'block'
    }
}

// 업데이트 가능 숨기기
function hideUpdateAvailable() {
    const container = document.getElementById('updateAvailableContainer')
    if (container) {
        container.style.display = 'none'
    }
}

// 업데이트 확인 시 표시
ipcRenderer.on('updateAvailable', (event, version) => {
    showUpdateAvailable()
})

// 업데이트 완료 시 숨기기
ipcRenderer.on('updateDownloaded', () => {
    hideUpdateAvailable()
})

// 업데이트 알림 팝업 표시
function showUpdatePopup(newVersion) {
    const modalContainer = document.createElement('div')
    modalContainer.className = 'update_popup'

    const title = document.createElement('h3')
    title.className = 'update_popup_title'
    title.textContent = '새로운 업데이트가 있습니다!'

    const message = document.createElement('p')
    message.className = 'update_popup_message'
    message.textContent = `새로운 버전 ${newVersion}이(가)\n사용 가능합니다.\n\n런처를 재시작하여 업데이트를\n설치하시겠습니까?`

    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'update_popup_buttons'

    const updateButton = document.createElement('button')
    updateButton.className = 'update_popup_button primary'
    updateButton.textContent = '지금 업데이트'
    
    const statusMessage = document.createElement('div')
    statusMessage.className = 'update_status_message'
    statusMessage.textContent = '업데이트를 다운로드하는 중...'

    updateButton.onclick = () => {
        updateButton.classList.add('loading')
        updateButton.disabled = true
        laterButton.style.display = 'none'
        statusMessage.classList.add('visible')
        shell.openExternal('https://github.com/A2kk-Server/A2kk-Launcher-Monorepo/releases/latest/download/A2kk-mac.dmg')
        modalContainer.remove()
    }

    const laterButton = document.createElement('button')
    laterButton.className = 'update_popup_button'
    laterButton.textContent = '나중에'
    laterButton.onclick = () => modalContainer.remove()

    buttonContainer.appendChild(updateButton)
    buttonContainer.appendChild(laterButton)
    modalContainer.appendChild(title)
    modalContainer.appendChild(message)
    modalContainer.appendChild(buttonContainer)
    modalContainer.appendChild(statusMessage)
    document.body.appendChild(modalContainer)
}

// 다운로드 진행 상태 업데이트
ipcRenderer.on('updateDownloadProgress', (event, progress) => {
    const statusMessage = document.querySelector('.update_status_message')
    if (statusMessage) {
        statusMessage.textContent = `업데이트 다운로드 중... ${Math.round(progress)}%`
    }
})

// 다운로드 완료
ipcRenderer.on('updateDownloaded', () => {
    const statusMessage = document.querySelector('.update_status_message')
    if (statusMessage) {
        statusMessage.textContent = '업데이트 설치 준비 완료'
    }
    // 3초 후 자동으로 재시작
    setTimeout(() => {
        ipcRenderer.send('restartApp')
    }, 3000)
})

document.addEventListener('readystatechange', function () {
    if (document.readyState === 'interactive'){
        loggerUICore.info('UICore Initializing..')

        // Bind close button.
        Array.from(document.getElementsByClassName('fCb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.close()
            })
        })

        // Bind restore down button.
        Array.from(document.getElementsByClassName('fRb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                if(window.isMaximized()){
                    window.unmaximize()
                } else {
                    window.maximize()
                }
                document.activeElement.blur()
            })
        })

        // Bind minimize button.
        Array.from(document.getElementsByClassName('fMb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.minimize()
                document.activeElement.blur()
            })
        })

        // Remove focus from social media buttons once they're clicked.
        Array.from(document.getElementsByClassName('mediaURL')).map(val => {
            val.addEventListener('click', e => {
                document.activeElement.blur()
            })
        })

    } else if(document.readyState === 'complete'){

        //266.01
        //170.8
        //53.21
        // Bind progress bar length to length of bot wrapper
        //const targetWidth = document.getElementById("launch_content").getBoundingClientRect().width
        //const targetWidth2 = document.getElementById("server_selection").getBoundingClientRect().width
        //const targetWidth3 = document.getElementById("launch_button").getBoundingClientRect().width

        document.getElementById('launch_details').style.maxWidth = 266.01
        document.getElementById('launch_progress').style.width = 170.8
        document.getElementById('launch_details_right').style.maxWidth = 170.8
        document.getElementById('launch_progress_label').style.width = 53.21
        
    }

}, false)

/**
 * Open web links in the user's default browser.
 */
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault()
    shell.openExternal(this.href)
})

/**
 * Opens DevTools window if you hold (ctrl + shift + i).
 * This will crash the program if you are using multiple
 * DevTools, for example the chrome debugger in VS Code. 
 */
document.addEventListener('keydown', function (e) {
    if((e.key === 'I' || e.key === 'i') && e.ctrlKey && e.shiftKey){
        let window = remote.getCurrentWindow()
        window.toggleDevTools()
    }
})

// 업데이트 버튼 상태 업데이트 함수
function settingsUpdateButtonStatus(text, disabled = false, handler = null){
    const button = document.getElementById('settingsUpdateActionButton')
    if(button) {
        button.innerHTML = text
        button.disabled = disabled
        if(handler != null){
            button.onclick = handler
        }
    }
}

// 업데이트 UI 표시 함수
function populateSettingsUpdateInformation(data){
    if(data != null){
        settingsUpdateTitle.innerHTML = isPrerelease(data.version) ? 
            Lang.queryJS('settings.updates.newPreReleaseTitle') : 
            Lang.queryJS('settings.updates.newReleaseTitle')
        settingsUpdateChangelogCont.style.display = null
        settingsUpdateChangelogTitle.innerHTML = data.releaseName
        settingsUpdateChangelogText.innerHTML = data.releaseNotes
        populateVersionInformation(data.version, settingsUpdateVersionValue, settingsUpdateVersionTitle, settingsUpdateVersionCheck)
        
        if(process.platform === 'darwin'){
            settingsUpdateButtonStatus(Lang.queryJS('settings.updates.downloadButton'), false, () => {
                shell.openExternal(data.darwindownload)
            })
        } else {
            settingsUpdateButtonStatus(Lang.queryJS('settings.updates.downloadingButton'), true)
        }
    } else {
        settingsUpdateTitle.innerHTML = Lang.queryJS('settings.updates.latestVersionTitle')
        settingsUpdateChangelogCont.style.display = 'none'
        populateVersionInformation(remote.app.getVersion(), settingsUpdateVersionValue, settingsUpdateVersionTitle, settingsUpdateVersionCheck)
        settingsUpdateButtonStatus(Lang.queryJS('settings.updates.checkForUpdatesButton'), false, () => {
            if(!isDev){
                ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                settingsUpdateButtonStatus(Lang.queryJS('settings.updates.checkingForUpdatesButton'), true)
            }
        })
    }
}