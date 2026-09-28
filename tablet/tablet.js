/*
=========================================================
SCREENPEN TABLET CLIENT
=========================================================
*/


/* =======================================================
   WEBSOCKET
======================================================= */

console.log("SCREENPEN JAVASCRIPT TEST - v9");
const connectionStatus =
    document.getElementById(
        "connectionStatus"
    );

const pcConnectionPanel =
    document.getElementById(
        "pcConnectionPanel"
    );


const pcIPInput =
    document.getElementById(
        "pcIPInput"
    );


const connectPCBtn =
    document.getElementById(
        "connectPCBtn"
    );


const localModeBtn =
    document.getElementById(
        "localModeBtn"
    );

const {
    CapacitorBarcodeScanner,
    CapacitorBarcodeScannerTypeHint,
    CapacitorBarcodeScannerCameraDirection,
    CapacitorBarcodeScannerScanOrientation,
    ScreenOrientation
} = Capacitor.Plugins;

let ws = null;


let reconnectTimer = null;


let manualClose = false;


/* =========================================================
   SCREENPEN CONNECTION
========================================================= */

let screenPenIP =
    localStorage.getItem(
        "screenPenIP"
    ) || "";


let screenPenPort =
    8765;


let localMode =
    false;


/* =========================================================
   CONNECTION HELPERS
========================================================= */

function saveScreenPenIP(
    ip
) {

    localStorage.setItem(
        "screenPenIP",
        ip
    );

}


function clearScreenPenIP() {

    localStorage.removeItem(
        "screenPenIP"
    );

}


function getWebSocketURL() {

    if (
        !screenPenIP
    ) {

        return null;

    }


    return (
        "wss://" +
        screenPenIP +
        ":" +
        screenPenPort
    );

}

function updateConnectionStatus(text, icon) {
    if (!connectionStatus) return;

    connectionStatus.innerHTML =
        icon + " <span>" + text + "</span>";
}

/* =========================================================
   CONNECT TO PC
========================================================= */

function connectToPC(ip) {
    const cleanedIP = String(ip || "").trim();

    if (!cleanedIP) {
        updateConnectionStatus(
            "Disconnected",
            "🔴"
        );

        updateHomeConnectionMessage(
            "Please enter PC IP",
            "🔴"
        );

        console.log(
            "Please enter the Windows PC IP address."
        );

        return;
    }

    const ipv4Pattern =
        /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

    if (!ipv4Pattern.test(cleanedIP)) {
        updateConnectionStatus(
            "Invalid IP",
            "🔴"
        );

        updateHomeConnectionMessage(
            "Invalid PC IP",
            "🔴"
        );

        console.log(
            "Invalid IPv4 address:",
            cleanedIP
        );

        return;
    }

    localMode = false;

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    screenPenIP = cleanedIP;
    screenPenPort = 8765;

    if (ws) {
        const oldSocket = ws;
        ws = null;

        if (
            oldSocket.readyState === WebSocket.OPEN ||
            oldSocket.readyState === WebSocket.CONNECTING
        ) {
            try {
                oldSocket.close(
                    1000,
                    "Switching PC"
                );
            } catch (error) {
                console.log(
                    "Error closing previous WebSocket:",
                    error
                );
            }
        }
    }

    updateConnectionStatus(
        "Connecting...",
        "🟠"
    );

    updateHomeConnectionMessage(
        "Connecting to " + cleanedIP + "...",
        "🟠"
    );

    console.log(
        "Connecting to ScreenPen PC:",
        cleanedIP
    );

    console.log(
        "WebSocket URL:",
        getWebSocketURL()
    );

    connectWebSocket();
}

/* =========================================================
   WEBSOCKET CONNECTION
========================================================= */

function connectWebSocket() {

    if (
        localMode
    ) {

        console.log(
            "Local Mode active. WebSocket connection skipped."
        );

        return;

    }


    if (
        !screenPenIP
    ) {

        console.log(
            "ScreenPen PC IP is not available."
        );

        connectionStatus.innerHTML =
            "🟠 <span>Enter PC IP</span>";

        updateHomeConnectionMessage(
            "Enter PC IP",
            "🟠"
        );

        return;

    }


    if (
        ws &&
        (
            ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING
        )
    ) {

        return;

    }


    manualClose =
        false;


    const url =
        getWebSocketURL();


    console.log(
        "Connecting to ScreenPen:",
        url
    );


    connectionStatus.innerHTML =
        "🟠 <span>Connecting...</span>";

    updateHomeConnectionMessage(
        "Connecting to " + screenPenIP + "...",
        "🟠"
    );


    ws =
        new WebSocket(
            url
        );


    ws.onopen = () => {

        connectionStatus.innerHTML =
            "🟢 <span>Connected</span>";


        console.log(
            "WebSocket connected."
        );


        saveScreenPenIP(
            screenPenIP
        );


        updateHomeConnectionState(
            true
        );


        updateHomeConnectionMessage(
            "Connected to " + screenPenIP,
            "🟢"
        );


        showDrawingInterface();


        sendCommand(
            "tool:" + tool
        );


        sendCommand(
            "color",
            color
        );


        sendCommand(
            "size",
            brushSize
        );


        sendCommand(
            "eraser_size",
            eraserSize
        );

    };


    ws.onclose = () => {

        connectionStatus.innerHTML =
            "🔴 <span>Disconnected</span>";


        console.log(
            "WebSocket disconnected."
        );


        updateHomeConnectionState(
            false
        );


        updateHomeConnectionMessage(
            "Disconnected",
            "🔴"
        );


        if (
            !manualClose &&
            !localMode
        ) {

            scheduleReconnect();

        }

    };


    ws.onerror = error => {

        console.error(
            "WebSocket error:",
            error
        );


        connectionStatus.innerHTML =
            "🔴 <span>Connection Error</span>";


        updateHomeConnectionMessage(
            "Connection Error",
            "🔴"
        );

    };

}


/* =========================================================
   AUTOMATIC RECONNECT
========================================================= */

function scheduleReconnect() {

    if (
        localMode
    ) {

        return;

    }


    if (
        !screenPenIP
    ) {

        return;

    }


    if (
        reconnectTimer
    ) {

        return;

    }


    reconnectTimer =
        setTimeout(
            () => {

                reconnectTimer =
                    null;


                if (
                    !localMode
                ) {

                    connectWebSocket();

                }

            },
            2000
        );

}


/* =========================================================
   LOCAL MODE
========================================================= */

function enterLocalMode() {

    console.log(
        "Entering Local Mode."
    );

    // Enable Local Mode
    localMode = true;

    // Stop automatic reconnect
    manualClose = true;

    if (reconnectTimer) {

        clearTimeout(
            reconnectTimer
        );

        reconnectTimer = null;

    }

    // Stop screen preview
    closeScreenPreview();

    // Close PC WebSocket
    if (ws) {

        const oldSocket = ws;

        ws = null;

        if (
            oldSocket.readyState ===
                WebSocket.OPEN ||
            oldSocket.readyState ===
                WebSocket.CONNECTING
        ) {

            try {

                oldSocket.close(
                    1000,
                    "Entering Local Mode"
                );

            } catch (error) {

                console.log(
                    "Error closing WebSocket:",
                    error
                );

            }

        }

    }

    // Update status
    connectionStatus.innerHTML =
        "🔵 <span>Local Mode</span>";

    updateHomeConnectionState(
        false
    );

    updateHomeConnectionMessage(
        "Local Mode",
        "🔵"
    );

    // Open drawing interface
    showDrawingInterface();

}

/* =======================================================
   ELEMENTS
======================================================= */

const canvas =
    document.getElementById(
        "drawingCanvas"
    );


const ctx =
    canvas.getContext(
        "2d"
    );


const penBtn =
    document.getElementById(
        "penBtn"
    );


const highlighterBtn =
    document.getElementById(
        "highlighterBtn"
    );


const eraserBtn =
    document.getElementById(
        "eraserBtn"
    );


const arrowBtn =
    document.getElementById(
        "arrowBtn"
    );


const rectangleBtn =
    document.getElementById(
        "rectangleBtn"
    );


const circleBtn =
    document.getElementById(
        "circleBtn"
    );


const undoBtn =
    document.getElementById(
        "undoBtn"
    );


const clearBtn =
    document.getElementById(
        "clearBtn"
    );


const screenBtn =
    document.getElementById(
        "screenBtn"
    );


const exitBtn =
    document.getElementById(
        "exitBtn"
    );


const colorPicker =
    document.getElementById(
        "colorPicker"
    );


const colorPreview =
    document.getElementById(
        "colorPreview"
    );


const sizeSlider =
    document.getElementById(
        "sizeSlider"
    );


const sizeValue =
    document.getElementById(
        "sizeValue"
    );


const sizeTitle =
    document.querySelector(
        ".toolbarSizeLabel"
    );

/* =======================================================
   STAGE 1 UI ELEMENTS
======================================================= */

const homeScreen=
    document.getElementById(
        "homeScreen"
    );

const setupGuide=
    document.getElementById(
        "setupGuide"
    );

const drawingInterface=
    document.getElementById(
        "drawingInterface"
    );

const downloadPCBtn=
    document.getElementById(
        "downloadPCBtn"
    );

const setupBackBtn=
    document.getElementById(
        "setupBackBtn"
    );

const setupBackHomeBtn=
    document.getElementById(
        "setupBackHomeBtn"
    );

const setupWebsiteBtn=
    document.getElementById(
        "setupWebsiteBtn"
    );

const scanQRBtn=
    document.getElementById(
        "scanQRBtn"
    );

const manualIPBtn=
    document.getElementById(
        "manualIPBtn"
    );

const qrScanPanel=
    document.getElementById(
        "qrScanPanel"
    );

const manualIPPanel=
    document.getElementById(
        "manualIPPanel"
    );

const homeConnectionStatus=
    document.getElementById(
        "homeConnectionStatus"
    );

const manageConnectionsBtn=
    document.getElementById(
        "manageConnectionsBtn"
    );

const screenPreviewToggleBtn=
    document.getElementById(
        "screenPreviewToggleBtn"
    );

const settingsBtn=
    document.getElementById(
        "settingsBtn"
    );

/* =======================================================

   LIVE SCREEN STREAM

======================================================= */

/*
    ScreenPen control WebSocket:
        8765

    ScreenPen desktop screen stream:
        8766

    The screen stream uses a separate WebSocket
    so screen frames do not interfere with
    drawing commands.
*/

const STREAM_PORT = 8766;


function getScreenStreamURL() {

    if (
        !screenPenIP
    ) {

        return null;

    }


    return (
        "wss://" +
        screenPenIP +
        ":" +
        STREAM_PORT
    );

}


const screenPreviewContainer =
    document.getElementById(
        "screenPreviewContainer"
    );


const screenPreview =
    document.getElementById(
        "screenPreview"
    );

const drawingScreenPreview =
    document.getElementById(
        "drawingScreenPreview"
    );


const screenStreamStatus =
    document.getElementById(
        "screenStreamStatus"
    );


let screenStreamSocket = null;


let screenStreamObjectUrl = null;


let screenStreamEnabled = false;


/* =======================================================
   CONNECT SCREEN STREAM
======================================================= */

function connectScreenStream() {

    if (localMode) {

        console.log(
            "Local Mode active. Screen stream skipped."
        );

        return;
    }


    if (!screenPenIP) {

        console.log(
            "ScreenPen PC IP is not available."
        );

        if (screenStreamStatus) {
            screenStreamStatus.textContent =
                "🔴";
        }

        return;
    }


    if (!screenStreamEnabled) {

        console.log(
            "Screen stream is disabled."
        );

        return;
    }


    if (
        screenStreamSocket &&
        (
            screenStreamSocket.readyState ===
                WebSocket.OPEN ||
            screenStreamSocket.readyState ===
                WebSocket.CONNECTING
        )
    ) {

        return;
    }


    const streamURL =
        getScreenStreamURL();


    if (!streamURL) {

        console.log(
            "Screen stream URL is not available."
        );

        if (screenStreamStatus) {
            screenStreamStatus.textContent =
                "🔴";
        }

        return;
    }


    console.log(
        "Connecting to ScreenPen screen stream:",
        streamURL
    );


    if (screenStreamStatus) {
        screenStreamStatus.textContent =
            "🟠";
    }


    screenStreamSocket =
        new WebSocket(
            streamURL
        );


    screenStreamSocket.binaryType =
        "blob";


    screenStreamSocket.onopen = () => {

        console.log(
            "Screen stream connected."
        );


        if (screenStreamStatus) {
            screenStreamStatus.textContent =
                "🟢";
        }

    };


    screenStreamSocket.onmessage =
        event => {

            if (
                !screenStreamEnabled ||
                localMode
            ) {
                return;
            }


            if (
                !(event.data instanceof Blob)
            ) {
                return;
            }


            if (screenPreview) {

                const newURL =
                    URL.createObjectURL(
                        event.data
                    );


                const oldURL =
                    screenStreamObjectUrl;


                screenStreamObjectUrl =
                    newURL;


                if (screenPreview) {
    screenPreview.src = newURL;
}

if (drawingScreenPreview) {
    drawingScreenPreview.src = newURL;
}


                if (oldURL) {

                    URL.revokeObjectURL(
                        oldURL
                    );

                }

            }

        };


    screenStreamSocket.onerror =
        error => {

            console.error(
                "Screen stream error:",
                error
            );


            if (screenStreamStatus) {
                screenStreamStatus.textContent =
                    "🔴";
            }

        };


    screenStreamSocket.onclose =
        () => {

            console.log(
                "Screen stream disconnected."
            );


            if (screenStreamStatus) {
                screenStreamStatus.textContent =
                    "🔴";
            }


            screenStreamSocket =
                null;


            if (
                screenStreamEnabled &&
                !localMode &&
                screenPenIP
            ) {

                setTimeout(
                    () => {

                        if (
                            screenStreamEnabled &&
                            !localMode &&
                            screenPenIP &&
                            (
                                !screenStreamSocket ||
                                screenStreamSocket.readyState !==
                                    WebSocket.OPEN
                            )
                        ) {

                            connectScreenStream();

                        }

                    },
                    2000
                );

            }

        };

}

/* =======================================================
   OPEN SCREEN PREVIEW
======================================================= */

function openScreenPreview() {

    if (localMode) {

        console.log(
            "Screen preview is unavailable in Local Mode."
        );

        if (screenStreamStatus) {
            screenStreamStatus.textContent =
                "🔴";
        }

        return;
    }


    if (!screenPenIP) {

        console.log(
            "Connect to a PC before opening screen preview."
        );

        if (screenStreamStatus) {
            screenStreamStatus.textContent =
                "🔴";
        }

        updateHomeConnectionMessage(
            "Connect to a PC first",
            "🟠"
        );

        return;
    }


    // Make sure the control WebSocket
    // is actually connected before
    // starting the screen stream.
    if (
        !ws ||
        ws.readyState !== WebSocket.OPEN
    ) {

        console.log(
            "PC control connection is not ready."
        );

        if (screenStreamStatus) {
            screenStreamStatus.textContent =
                "🔴";
        }

        return;
    }


    screenStreamEnabled =
        true;


    if (screenPreviewContainer) {

        screenPreviewContainer.style.display =
            "block";

    }


    console.log(
        "Opening ScreenPen desktop preview..."
    );


    connectScreenStream();

}


/* =======================================================
   CLOSE SCREEN PREVIEW
======================================================= */

function closeScreenPreview() {

    screenStreamEnabled =
        false;


    if (
        screenPreviewContainer
    ) {

        screenPreviewContainer.style.display =
            "none";

    }


    if (
        screenStreamSocket
    ) {

        try {

            screenStreamSocket.close();

        }

        catch (error) {

            console.warn(
                "Screen stream close warning:",
                error
            );

        }

        screenStreamSocket =
            null;

    }


    if (
        screenStreamObjectUrl
    ) {

        URL.revokeObjectURL(
            screenStreamObjectUrl
        );

        screenStreamObjectUrl =
            null;

    }


    if (
        screenPreview
    ) {

        screenPreview.removeAttribute(
            "src"
        );

    }


    if (
        screenStreamStatus
    ) {

        screenStreamStatus.textContent =
            "🔴";

    }

}


/* =======================================================
   TOGGLE SCREEN PREVIEW
======================================================= */

function toggleScreenPreview() {

    if (
        screenStreamEnabled
    ) {

        closeScreenPreview();

    }

    else {

        openScreenPreview();

    }

}

/* =======================================================
   STAGE 1 NAVIGATION
======================================================= */

async function setOrientation(mode) {
    try {
        if (!ScreenOrientation) {
            console.log("ScreenOrientation plugin unavailable.");
            return;
        }

        await ScreenOrientation.lock({
            orientation: mode
        });

        console.log(
            "Screen orientation locked:",
            mode
        );

    } catch (error) {
        console.log(
            "Screen orientation lock failed:",
            error
        );
    }
}

function showHomeScreen(){
    setOrientation("portrait");

    if(homeScreen){
        homeScreen.hidden=false;
        homeScreen.style.display="block";
    }

    if(setupGuide){
        setupGuide.hidden=true;
        setupGuide.style.display="none";
    }

    if(drawingInterface){
        drawingInterface.hidden=true;
        drawingInterface.style.display="none";
    }

    setOrientation("portrait");

    updateHomeConnectionState(
        !!(
            ws &&
            ws.readyState === WebSocket.OPEN
        )
    );
}

function showSetupGuide(){
    if(homeScreen){
        homeScreen.hidden=true;
        homeScreen.style.display="none";
    }

    if(setupGuide){
        setupGuide.hidden=false;
        setupGuide.style.display="block";
    }

    if(drawingInterface){
        drawingInterface.hidden=true;
        drawingInterface.style.display="none";
    }

    setOrientation("portrait");
}

function showDrawingInterface(){
    if(homeScreen){
        homeScreen.hidden=true;
        homeScreen.style.display="none";
    }

    if(setupGuide){
        setupGuide.hidden=true;
        setupGuide.style.display="none";
    }

    if(drawingInterface){
        drawingInterface.hidden=false;
        drawingInterface.style.display="block";
    }

    setOrientation("landscape");

    setTimeout(()=>{
        resizeCanvas();
        renderCanvas();
    },100);
}

function updateHomeConnectionState(connected){
    if(!homeConnectionStatus){
        return;
    }

    if(localMode){
        homeConnectionStatus.innerHTML=
            "🔵 <span>Local Mode</span>";
        return;
    }

    if(connected){
        homeConnectionStatus.innerHTML=
            "🟢 <span>Connected to "+screenPenIP+"</span>";
        return;
    }

    homeConnectionStatus.innerHTML=
        "⚪ <span>Not Connected</span>";
}


function updateHomeConnectionMessage(
    text,
    icon
){
    if(!homeConnectionStatus){
        return;
    }

    homeConnectionStatus.innerHTML =
        icon +
        " <span>" +
        text +
        "</span>";
}

function openManualIPPanel(){
    if(qrScanPanel){
        qrScanPanel.style.display="none";
    }

    if(manualIPPanel){
        manualIPPanel.style.display="block";
    }

    if(scanQRBtn){
        scanQRBtn.classList.remove("active");
    }

    if(manualIPBtn){
        manualIPBtn.classList.add("active");
    }
}

function openQRPanel(){
    if(qrScanPanel){
        qrScanPanel.style.display="block";
    }

    if(manualIPPanel){
        manualIPPanel.style.display="none";
    }

    if(scanQRBtn){
        scanQRBtn.classList.add("active");
    }

    if(manualIPBtn){
        manualIPBtn.classList.remove("active");
    }
}

async function scanScreenPenQR(){
    try{
        console.log("Starting ScreenPen QR scanner...");

        const result =
            await CapacitorBarcodeScanner.scanBarcode({
                hint: 0,
                scanInstructions: "Scan the ScreenPen QR code",
                scanButton: false,
                scanText: "Scan",
                cameraDirection: 1,
                scanOrientation: 1
            });

        const scannedValue =
            result &&
            result.ScanResult
                ? result.ScanResult.trim()
                : "";

        console.log(
            "QR scan result:",
            scannedValue
        );

        if(!scannedValue){
            console.log("No QR code scanned.");

            updateConnectionStatus(
                "No QR Code",
                "🔴"
            );

            updateHomeConnectionMessage(
                "No QR code scanned",
                "🔴"
            );

            return;
        }

        let parsedURL;

        try{
            parsedURL =
                new URL(scannedValue);
        }catch(error){
            console.error(
                "Invalid QR data:",
                scannedValue
            );

            updateConnectionStatus(
                "Invalid QR Code",
                "🔴"
            );

            updateHomeConnectionMessage(
                "Invalid QR Code",
                "🔴"
            );

            return;
        }

        if(
            parsedURL.protocol !==
            "screenpen:"
        ){
            console.error(
                "Not a ScreenPen QR code."
            );

            updateConnectionStatus(
                "Invalid ScreenPen QR",
                "🔴"
            );

            updateHomeConnectionMessage(
                "Invalid ScreenPen QR",
                "🔴"
            );

            return;
        }

        if(
            parsedURL.hostname !==
            "connect"
        ){
            console.error(
                "Invalid ScreenPen QR host."
            );

            updateConnectionStatus(
                "Invalid ScreenPen QR",
                "🔴"
            );

            updateHomeConnectionMessage(
                "Invalid ScreenPen QR",
                "🔴"
            );

            return;
        }

        const host =
            parsedURL.searchParams.get(
                "host"
            );

        const controlPort =
            parsedURL.searchParams.get(
                "control"
            );

        const screenPort =
            parsedURL.searchParams.get(
                "screen"
            );

        console.log(
            "QR Host:",
            host
        );

        console.log(
            "QR Control Port:",
            controlPort
        );

        console.log(
            "QR Screen Port:",
            screenPort
        );

        const ipv4Pattern =
            /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

        if(
            !host ||
            !ipv4Pattern.test(host)
        ){
            updateConnectionStatus(
                "Invalid PC IP",
                "🔴"
            );

            updateHomeConnectionMessage(
                "Invalid PC IP",
                "🔴"
            );

            return;
        }

        if(
            controlPort &&
            controlPort !== "8765"
        ){
            updateConnectionStatus(
                "Invalid Control Port",
                "🔴"
            );

            updateHomeConnectionMessage(
                "Invalid Control Port",
                "🔴"
            );

            return;
        }

        if(
            screenPort &&
            screenPort !== "8766"
        ){
            updateConnectionStatus(
                "Invalid Screen Port",
                "🔴"
            );

            updateHomeConnectionMessage(
                "Invalid Screen Port",
                "🔴"
            );

            return;
        }

        screenPenIP =
            host;

        screenPenPort =
            8765;

        saveScreenPenIP(
            host
        );

        if(pcIPInput){
            pcIPInput.value =
                host;
        }

        console.log(
            "ScreenPen PC detected:",
            host
        );

        updateConnectionStatus(
            "PC Found",
            "🟢"
        );

        updateHomeConnectionMessage(
            "PC Found: " + host,
            "🟢"
        );

        connectToPC(
            host
        );

    }catch(error){
        console.error(
            "QR scanner error:",
            error
        );

        updateConnectionStatus(
            "Scanner Error",
            "🔴"
        );

        updateHomeConnectionMessage(
            "Scanner Error",
            "🔴"
        );
    }
}

/* =======================================================
   STATE
======================================================= */

let tool =
    "pen";


let color =
    "#ff0000";


let brushSize =
    5;


let eraserSize =
    20;


let drawing =
    false;



/* =======================================================
   OBJECT STORAGE
======================================================= */

let localObjects =
    [];


let nextObjectId =
    1;


/* =======================================================
   CURRENT DRAWING
======================================================= */

let currentStroke =
    null;


let currentShape =
    null;


/* =======================================================
   MOVE / SELECTION STATE
======================================================= */

let movingObject =
    null;


let movingObjectId =
    null;


let draggingSelected =
    false;


let lastMovePosition =
    null;


let movingPointerId =
    null;


/*
    First tap on an existing object is temporarily
    stored here.

    This prevents accidental tiny drawings when the
    user is trying to double-tap.
*/

let pendingObjectTap =
    null;


const DRAG_THRESHOLD =
    8;


/* =======================================================
   DOUBLE TAP
======================================================= */

let lastTapTime =
    0;


let lastTapPosition =
    null;


const DOUBLE_TAP_TIME =
    400;


const DOUBLE_TAP_DISTANCE =
    50;


/* =======================================================
   CANVAS
======================================================= */

function resizeCanvas() {

    canvas.width =
        window.innerWidth;


    canvas.height =
        window.innerHeight;


    renderCanvas();

}


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =======================================================
   POSITION
======================================================= */

function getPosition(
    event
) {

    const rect =
        canvas.getBoundingClientRect();


    return {

        x:
            event.clientX -
            rect.left,

        y:
            event.clientY -
            rect.top

    };

}


/* =======================================================
   POINTER RELEASE
======================================================= */

function releasePointer(
    pointerId
) {

    try {

        if (
            canvas.hasPointerCapture(
                pointerId
            )
        ) {

            canvas.releasePointerCapture(
                pointerId
            );

        }

    }

    catch (
    error
    ) {

        console.warn(
            "Pointer release warning:",
            error
        );

    }

}


/* =======================================================
   SEND
======================================================= */

function send(
    data
) {

    if (
        !ws ||
        ws.readyState !==
        WebSocket.OPEN
    ) {

        return false;

    }


    ws.send(
        JSON.stringify(
            data
        )
    );


    return true;

}


/* =======================================================
   COMMAND
======================================================= */

function sendCommand(
    command,
    value = null,
    extra = {}
) {

    send({

        type:
            "command",

        command:
            command,

        value:
            value,

        ...extra

    });

}


/* =======================================================
   POINTER
======================================================= */

function sendPointer(
    eventType,
    position,
    event,
    extra = {}
) {

    send({

        type:
            "pointer",

        event:
            eventType,

        x:
            position.x,

        y:
            position.y,

        canvasWidth:
            canvas.width,

        canvasHeight:
            canvas.height,

        pressure:
            event.pressure ||
            0.5,

        pointerType:
            event.pointerType ||
            "touch",

        tool:
            tool,

        ...extra

    });

}


/* =======================================================
   TOOL SELECTION
======================================================= */

function selectTool(
    selectedTool
) {

    tool =
        selectedTool;


    movingObject =
        null;


    movingObjectId =
        null;


    draggingSelected =
        false;


    lastMovePosition =
        null;


    movingPointerId =
        null;


    pendingObjectTap =
        null;


    currentStroke =
        null;


    currentShape =
        null;


    sendCommand(
        "tool:" +
        selectedTool
    );


    updateActiveTool();


    updateSizeControl();


    renderCanvas();

}


/* =======================================================
   ACTIVE TOOL
======================================================= */

function updateActiveTool() {

    const buttons = [

        penBtn,

        highlighterBtn,

        eraserBtn,

        arrowBtn,

        rectangleBtn,

        circleBtn

    ];


    buttons.forEach(
        button => {

            if (
                button
            ) {

                button.classList.remove(
                    "active"
                );

            }

        }
    );


    const map = {

        pen:
            penBtn,

        highlighter:
            highlighterBtn,

        eraser:
            eraserBtn,

        arrow:
            arrowBtn,

        rectangle:
            rectangleBtn,

        circle:
            circleBtn

    };


    if (
        map[tool]
    ) {

        map[tool].classList.add(
            "active"
        );

    }

}


/* =======================================================
   SIZE CONTROL
======================================================= */

function updateSizeControl() {

    if (
        tool === "eraser"
    ) {

        sizeTitle.textContent =
            "Eraser Size";

        sizeSlider.min =
            "5";

        sizeSlider.max =
            "100";

        sizeSlider.value =
            eraserSize;

        sizeValue.textContent =
            eraserSize;

    }

    else {

        sizeTitle.textContent =
            "Brush Size";

        sizeSlider.min =
            "1";

        sizeSlider.max =
            "50";

        sizeSlider.value =
            brushSize;

        sizeValue.textContent =
            brushSize;

    }

}


/* =======================================================
   RENDER
======================================================= */

function renderCanvas() {

    ctx.clearRect(

        0,

        0,

        canvas.width,

        canvas.height

    );


    for (
        const object of localObjects
    ) {

        drawObject(
            object
        );

    }


    if (
        currentStroke
    ) {

        drawObject(
            currentStroke
        );

    }


    if (
        currentShape
    ) {

        drawObject(
            currentShape
        );

    }


    if (
        movingObject
    ) {

        drawSelection(
            movingObject
        );

    }

}


/* =======================================================
   DRAW OBJECT
======================================================= */

function drawObject(
    object
) {

    if (
        !object
    ) {

        return;

    }


    if (
        object.type === "pen" ||
        object.type === "highlighter"
    ) {

        drawStroke(
            object
        );

    }

    else if (
        object.type === "arrow"
    ) {

        drawArrow(

            object.start,

            object.end,

            object.color,

            object.size

        );

    }

    else if (
        object.type === "rectangle"
    ) {

        drawRectangle(

            object.start,

            object.end,

            object.color,

            object.size

        );

    }

    else if (
        object.type === "circle"
    ) {

        drawCircle(

            object.start,

            object.end,

            object.color,

            object.size

        );

    }

}


/* =======================================================
   STROKE
======================================================= */

function drawStroke(
    object
) {

    if (
        !object.points ||
        object.points.length === 0
    ) {

        return;

    }


    ctx.save();


    ctx.beginPath();


    ctx.moveTo(

        object.points[0].x,

        object.points[0].y

    );


    for (
        let i = 1;
        i < object.points.length;
        i++
    ) {

        ctx.lineTo(

            object.points[i].x,

            object.points[i].y

        );

    }


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    ctx.strokeStyle =
        object.color;


    ctx.globalAlpha =
        object.type ===
            "highlighter"

            ? 0.35

            : 1;


    ctx.lineWidth =
        object.type ===
            "highlighter"

            ? object.size * 4

            : object.size;


    ctx.stroke();


    ctx.restore();

}


/* =======================================================
   ARROW
======================================================= */

function drawArrow(
    start,
    end,
    arrowColor,
    arrowSize
) {

    ctx.save();


    ctx.strokeStyle =
        arrowColor;


    ctx.lineWidth =
        arrowSize;


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    ctx.beginPath();


    ctx.moveTo(
        start.x,
        start.y
    );


    ctx.lineTo(
        end.x,
        end.y
    );


    ctx.stroke();


    const angle =
        Math.atan2(

            end.y -
            start.y,

            end.x -
            start.x

        );


    const length =
        12 +
        arrowSize;


    const p1 = {

        x:
            end.x +
            length *
            Math.cos(
                angle +
                Math.PI * 0.8
            ),

        y:
            end.y +
            length *
            Math.sin(
                angle +
                Math.PI * 0.8
            )

    };


    const p2 = {

        x:
            end.x +
            length *
            Math.cos(
                angle -
                Math.PI * 0.8
            ),

        y:
            end.y +
            length *
            Math.sin(
                angle -
                Math.PI * 0.8
            )

    };


    ctx.beginPath();


    ctx.moveTo(
        end.x,
        end.y
    );


    ctx.lineTo(
        p1.x,
        p1.y
    );


    ctx.moveTo(
        end.x,
        end.y
    );


    ctx.lineTo(
        p2.x,
        p2.y
    );


    ctx.stroke();


    ctx.restore();

}


/* =======================================================
   RECTANGLE
======================================================= */

function drawRectangle(
    start,
    end,
    rectangleColor,
    rectangleSize
) {

    ctx.save();


    ctx.strokeStyle =
        rectangleColor;


    ctx.lineWidth =
        rectangleSize;


    const x =
        Math.min(
            start.x,
            end.x
        );


    const y =
        Math.min(
            start.y,
            end.y
        );


    const width =
        Math.abs(
            end.x -
            start.x
        );


    const height =
        Math.abs(
            end.y -
            start.y
        );


    ctx.strokeRect(

        x,

        y,

        width,

        height

    );


    ctx.restore();

}


/* =======================================================
   CIRCLE
======================================================= */

function drawCircle(
    start,
    end,
    circleColor,
    circleSize
) {

    ctx.save();


    ctx.strokeStyle =
        circleColor;


    ctx.lineWidth =
        circleSize;


    const x =
        Math.min(
            start.x,
            end.x
        );


    const y =
        Math.min(
            start.y,
            end.y
        );


    const width =
        Math.abs(
            end.x -
            start.x
        );


    const height =
        Math.abs(
            end.y -
            start.y
        );


    ctx.beginPath();


    ctx.ellipse(

        x +
        width / 2,

        y +
        height / 2,

        width / 2,

        height / 2,

        0,

        0,

        Math.PI * 2

    );


    ctx.stroke();


    ctx.restore();

}


/* =======================================================
   DOUBLE TAP
======================================================= */

function isDoubleTap(
    position
) {

    const now =
        Date.now();


    if (
        lastTapPosition ===
        null
    ) {

        lastTapTime =
            now;


        lastTapPosition = {

            x:
                position.x,

            y:
                position.y

        };


        return false;

    }


    const elapsed =
        now -
        lastTapTime;


    const distance =
        Math.hypot(

            position.x -
            lastTapPosition.x,

            position.y -
            lastTapPosition.y

        );


    const doubleTap =

        elapsed <=
        DOUBLE_TAP_TIME

        &&

        distance <=
        DOUBLE_TAP_DISTANCE;


    if (
        doubleTap
    ) {

        lastTapTime =
            0;


        lastTapPosition =
            null;

    }

    else {

        lastTapTime =
            now;


        lastTapPosition = {

            x:
                position.x,

            y:
                position.y

        };

    }


    return doubleTap;

}


/* =======================================================
   FIND OBJECT
======================================================= */

function findObjectAtPoint(
    point
) {

    for (
        let i =
            localObjects.length - 1;

        i >= 0;

        i--
    ) {

        if (
            objectHitTest(

                localObjects[i],

                point

            )
        ) {

            return localObjects[i];

        }

    }


    return null;

}


/* =======================================================
   OBJECT HIT TEST
======================================================= */

function objectHitTest(
    object,
    point
) {

    if (
        !object
    ) {

        return false;

    }


    const tolerance =
        30;


    /*
    PEN / HIGHLIGHTER
    */

    if (
        object.type === "pen" ||
        object.type === "highlighter"
    ) {

        const points =
            object.points ||
            [];


        const width =
            object.type ===
                "highlighter"

                ? (object.size || 5) * 4

                : (object.size || 5);


        if (
            points.length === 1
        ) {

            return (

                Math.hypot(

                    point.x -
                    points[0].x,

                    point.y -
                    points[0].y

                )

                <=

                tolerance +
                width / 2

            );

        }


        for (
            let i = 1;
            i < points.length;
            i++
        ) {

            if (

                distanceToSegment(

                    point,

                    points[i - 1],

                    points[i]

                )

                <=

                tolerance +
                width / 2

            ) {

                return true;

            }

        }


        return false;

    }


    /*
    ARROW
    */

    if (
        object.type === "arrow"
    ) {

        return (

            distanceToSegment(

                point,

                object.start,

                object.end

            )

            <=

            tolerance +
            (object.size || 5)

        );

    }


    /*
    RECTANGLE
    */

    if (
        object.type === "rectangle"
    ) {

        return pointNearRectangle(

            point,

            object.start,

            object.end,

            tolerance +
            (object.size || 5)

        );

    }


    /*
    CIRCLE
    */

    if (
        object.type === "circle"
    ) {

        return pointNearCircle(

            point,

            object.start,

            object.end,

            tolerance +
            (object.size || 5)

        );

    }


    return false;

}


/* =======================================================
   OBJECT DRAG HIT TEST
======================================================= */

function objectDragHitTest(
    object,
    point
) {

    if (
        !object
    ) {

        return false;

    }


    /*
    PEN / HIGHLIGHTER
    */

    if (
        object.type === "pen" ||
        object.type === "highlighter"
    ) {

        const points =
            object.points ||
            [];


        const width =
            object.type ===
                "highlighter"

                ? (object.size || 5) * 4

                : (object.size || 5);


        if (
            points.length === 1
        ) {

            return (

                Math.hypot(

                    point.x -
                    points[0].x,

                    point.y -
                    points[0].y

                )

                <=

                40 +
                width / 2

            );

        }


        for (
            let i = 1;
            i < points.length;
            i++
        ) {

            if (

                distanceToSegment(

                    point,

                    points[i - 1],

                    points[i]

                )

                <=

                40 +
                width / 2

            ) {

                return true;

            }

        }


        return false;

    }


    /*
    ARROW
    */

    if (
        object.type === "arrow"
    ) {

        return (

            distanceToSegment(

                point,

                object.start,

                object.end

            )

            <=

            40 +
            (object.size || 5)

        );

    }


    /*
    RECTANGLE

    IMPORTANT:
    The entire interior is draggable.
    */

    if (
        object.type === "rectangle"
    ) {

        const left =
            Math.min(

                object.start.x,

                object.end.x

            );


        const right =
            Math.max(

                object.start.x,

                object.end.x

            );


        const top =
            Math.min(

                object.start.y,

                object.end.y

            );


        const bottom =
            Math.max(

                object.start.y,

                object.end.y

            );


        const padding =
            25;


        return (

            point.x >=
            left - padding

            &&

            point.x <=
            right + padding

            &&

            point.y >=
            top - padding

            &&

            point.y <=
            bottom + padding

        );

    }


    /*
    CIRCLE

    The interior of the ellipse is draggable.
    */

    if (
        object.type === "circle"
    ) {

        const left =
            Math.min(

                object.start.x,

                object.end.x

            );


        const right =
            Math.max(

                object.start.x,

                object.end.x

            );


        const top =
            Math.min(

                object.start.y,

                object.end.y

            );


        const bottom =
            Math.max(

                object.start.y,

                object.end.y

            );


        const cx =
            left +
            (right - left) / 2;


        const cy =
            top +
            (bottom - top) / 2;


        const rx =
            Math.max(

                1,

                (right - left) / 2

            );


        const ry =
            Math.max(

                1,

                (bottom - top) / 2

            );


        const dx =
            point.x -
            cx;


        const dy =
            point.y -
            cy;


        const normalized =

            (
                dx * dx
            ) /
            (
                rx * rx
            )

            +

            (
                dy * dy
            ) /
            (
                ry * ry
            );


        return (
            normalized <=
            1.15
        );

    }


    return false;

}


/* =======================================================
   BEGIN DRAWING
======================================================= */

function beginDrawing(
    position,
    event
) {

    drawing =
        true;


    currentStroke =
        null;


    currentShape =
        null;


    canvas.setPointerCapture(
        event.pointerId
    );


    /*
    ERASER
    */

    if (
        tool === "eraser"
    ) {

        eraseLocal(
            position
        );


        sendPointer(

            "down",

            position,

            event

        );


        renderCanvas();


        return;

    }


    /*
    PEN / HIGHLIGHTER
    */

    if (
        tool === "pen" ||
        tool === "highlighter"
    ) {

        currentStroke = {

            type:
                tool,

            id:
                nextObjectId++,

            color:
                color,

            size:
                brushSize,

            points: [

                {

                    x:
                        position.x,

                    y:
                        position.y

                }

            ]

        };


        sendPointer(

            "down",

            position,

            event

        );


        renderCanvas();


        return;

    }


    /*
    SHAPES
    */

    if (
        tool === "arrow" ||
        tool === "rectangle" ||
        tool === "circle"
    ) {

        currentShape = {

            type:
                tool,

            id:
                nextObjectId++,

            start: {

                x:
                    position.x,

                y:
                    position.y

            },

            end: {

                x:
                    position.x,

                y:
                    position.y

            },

            color:
                color,

            size:
                brushSize

        };


        sendPointer(

            "down",

            position,

            event

        );


        renderCanvas();

    }

}


/* =======================================================
   POINTER DOWN
======================================================= */

canvas.addEventListener(
    "pointerdown",
    event => {

        if (
            event.pointerType === "mouse" &&
            event.button !== 0
        ) {

            return;

        }


        event.preventDefault();


        const position =
            getPosition(event);


        /*
        ==================================================
        SELECTED OBJECT + DRAG

        This uses objectDragHitTest(), which allows
        rectangles/circles to be grabbed from their
        interior.
        ==================================================
        */

        if (
            tool !== "eraser" &&
            movingObject &&
            objectDragHitTest(

                movingObject,

                position

            )
        ) {

            canvas.setPointerCapture(
                event.pointerId
            );


            draggingSelected =
                true;


            movingPointerId =
                event.pointerId;


            lastMovePosition = {

                x:
                    position.x,

                y:
                    position.y

            };


            drawing =
                false;


            currentStroke =
                null;


            currentShape =
                null;


            pendingObjectTap =
                null;


            console.log(

                "DRAG START:",

                movingObject.type,

                movingObject.id,

                "at:",

                position.x,

                position.y

            );


            renderCanvas();


            return;

        }


        /*
        ==================================================
        FIND OBJECT
        ==================================================
        */

        const objectAtPoint =

            tool !== "eraser"

                ? findObjectAtPoint(
                    position
                )

                : null;


        /*
        ==================================================
        DOUBLE TAP = SELECT
        ==================================================
        */

        if (
            tool !== "eraser" &&
            objectAtPoint &&
            isDoubleTap(
                position
            )
        ) {

            movingObject =
                objectAtPoint;


            movingObjectId =
                objectAtPoint.id;


            draggingSelected =
                false;


            lastMovePosition =
                null;


            movingPointerId =
                null;


            pendingObjectTap =
                null;


            drawing =
                false;


            currentStroke =
                null;


            currentShape =
                null;


            renderCanvas();


            console.log(

                "OBJECT SELECTED:",

                objectAtPoint.type,

                objectAtPoint.id

            );


            return;

        }


        /*
        ==================================================
        FIRST TAP ON EXISTING OBJECT

        Do NOT immediately create a new object.

        If this becomes a double tap, it selects.

        If the finger moves, it becomes a normal
        drawing gesture.
        ==================================================
        */

        if (
            tool !== "eraser" &&
            objectAtPoint
        ) {

            pendingObjectTap = {

                pointerId:
                    event.pointerId,

                startPosition: {

                    x:
                        position.x,

                    y:
                        position.y

                }

            };


            drawing =
                false;


            currentStroke =
                null;


            currentShape =
                null;


            canvas.setPointerCapture(
                event.pointerId
            );


            console.log(

                "OBJECT TAP CANDIDATE:",

                objectAtPoint.type,

                objectAtPoint.id

            );


            return;

        }


        /*
        ==================================================
        TAP OUTSIDE SELECTED OBJECT

        Clear selection.
        ==================================================
        */

        if (
            movingObject
        ) {

            movingObject =
                null;


            movingObjectId =
                null;


            draggingSelected =
                false;


            lastMovePosition =
                null;


            movingPointerId =
                null;


            pendingObjectTap =
                null;


            renderCanvas();

        }


        /*
        ==================================================
        NORMAL DRAWING
        ==================================================
        */

        beginDrawing(

            position,

            event

        );

    }
);


/* =======================================================
   POINTER MOVE
======================================================= */

canvas.addEventListener(
    "pointermove",
    event => {

        event.preventDefault();


        const position =
            getPosition(event);


        /*
        ==================================================
        MOVING SELECTED OBJECT
        ==================================================
        */

        if (
            draggingSelected &&
            movingObject &&
            event.pointerId ===
            movingPointerId &&
            lastMovePosition
        ) {

            const dx =
                position.x -
                lastMovePosition.x;


            const dy =
                position.y -
                lastMovePosition.y;


            /*
            Do not send useless 0,0 commands.
            */

            if (
                dx !== 0 ||
                dy !== 0
            ) {

                /*
                Update tablet immediately.
                */

                moveObjectLocally(

                    movingObject,

                    dx,

                    dy

                );


                console.log(

                    "DRAG MOVE:",

                    movingObject.id,

                    "dx:",

                    dx,

                    "dy:",

                    dy

                );


                /*
                Send normalized movement to Python.
                */

                sendCommand(

                    "move",

                    null,

                    {

                        objectId:
                            movingObjectId,

                        dxRatio:
                            dx /
                            canvas.width,

                        dyRatio:
                            dy /
                            canvas.height

                    }

                );


                lastMovePosition = {

                    x:
                        position.x,

                    y:
                        position.y

                };


                renderCanvas();

            }


            return;

        }


        /*
        ==================================================
        PENDING OBJECT TAP

        If the finger moves far enough, convert the
        pending tap into a normal drawing gesture.
        ==================================================
        */

        if (
            pendingObjectTap &&
            event.pointerId ===
            pendingObjectTap.pointerId
        ) {

            const start =
                pendingObjectTap.startPosition;


            const distance =
                Math.hypot(

                    position.x -
                    start.x,

                    position.y -
                    start.y

                );


            if (
                distance >=
                DRAG_THRESHOLD
            ) {

                pendingObjectTap =
                    null;


                beginDrawing(

                    start,

                    event

                );


                /*
                Continue the same gesture.
                */

                if (
                    currentStroke
                ) {

                    currentStroke.points.push({

                        x:
                            position.x,

                        y:
                            position.y

                    });

                }


                if (
                    currentShape
                ) {

                    currentShape.end = {

                        x:
                            position.x,

                        y:
                            position.y

                    };

                }


                sendPointer(

                    "move",

                    position,

                    event

                );


                renderCanvas();

            }


            return;

        }


        /*
        ==================================================
        NORMAL DRAWING
        ==================================================
        */

        if (
            !drawing
        ) {

            return;

        }


        /*
        ERASER
        */

        if (
            tool === "eraser"
        ) {

            eraseLocal(
                position
            );


            sendPointer(

                "move",

                position,

                event

            );


            return;

        }


        /*
        PEN / HIGHLIGHTER
        */

        if (
            currentStroke
        ) {

            currentStroke.points.push({

                x:
                    position.x,

                y:
                    position.y

            });


            sendPointer(

                "move",

                position,

                event

            );


            renderCanvas();


            return;

        }


        /*
        SHAPES
        */

        if (
            currentShape
        ) {

            currentShape.end = {

                x:
                    position.x,

                y:
                    position.y

            };


            sendPointer(

                "move",

                position,

                event

            );


            renderCanvas();

        }

    }
);


/* =======================================================
   POINTER UP
======================================================= */

canvas.addEventListener(
    "pointerup",
    event => {

        event.preventDefault();


        const position =
            getPosition(event);


        /*
        ==================================================
        FINISH MOVEMENT
        ==================================================
        */

        if (
            draggingSelected &&
            movingObject &&
            event.pointerId ===
            movingPointerId
        ) {

            console.log(

                "MOVE END:",

                movingObject.type,

                movingObject.id

            );


            sendCommand(

                "move_end",

                null,

                {

                    objectId:
                        movingObjectId

                }

            );


            /*
            Keep selected object selected.
            */

            draggingSelected =
                false;


            lastMovePosition =
                null;


            movingPointerId =
                null;


            releasePointer(
                event.pointerId
            );


            renderCanvas();


            return;

        }


        /*
        ==================================================
        PENDING OBJECT TAP
        ==================================================
        */

        if (
            pendingObjectTap &&
            event.pointerId ===
            pendingObjectTap.pointerId
        ) {

            pendingObjectTap =
                null;


            drawing =
                false;


            currentStroke =
                null;


            currentShape =
                null;


            releasePointer(
                event.pointerId
            );


            renderCanvas();


            return;

        }


        /*
        ==================================================
        NORMAL DRAWING
        ==================================================
        */

        if (
            !drawing
        ) {

            releasePointer(
                event.pointerId
            );


            return;

        }


        /*
        ERASER
        */

        if (
            tool === "eraser"
        ) {

            eraseLocal(
                position
            );


            sendPointer(

                "up",

                position,

                event

            );

        }


        /*
        PEN / HIGHLIGHTER
        */

        else if (
            currentStroke
        ) {

            currentStroke.points.push({

                x:
                    position.x,

                y:
                    position.y

            });


            localObjects.push(
                currentStroke
            );


            sendPointer(

                "up",

                position,

                event

            );


            currentStroke =
                null;


            renderCanvas();

        }


        /*
        SHAPE
        */

        else if (
            currentShape
        ) {

            currentShape.end = {

                x:
                    position.x,

                y:
                    position.y

            };


            localObjects.push(
                currentShape
            );


            sendPointer(

                "up",

                position,

                event

            );


            currentShape =
                null;


            renderCanvas();

        }


        drawing =
            false;


        releasePointer(
            event.pointerId
        );

    }
);


/* =======================================================
   POINTER CANCEL
======================================================= */

canvas.addEventListener(
    "pointercancel",
    event => {

        if (
            draggingSelected &&
            event.pointerId ===
            movingPointerId
        ) {

            sendCommand(

                "move_end",

                null,

                {

                    objectId:
                        movingObjectId

                }

            );


            draggingSelected =
                false;


            lastMovePosition =
                null;


            movingPointerId =
                null;


            renderCanvas();

        }


        if (
            pendingObjectTap &&
            event.pointerId ===
            pendingObjectTap.pointerId
        ) {

            pendingObjectTap =
                null;

        }


        drawing =
            false;


        currentStroke =
            null;


        currentShape =
            null;


        releasePointer(
            event.pointerId
        );

    }
);


/* =======================================================
   MOVE OBJECT LOCALLY
======================================================= */

function moveObjectLocally(
    object,
    dx,
    dy
) {

    if (
        object.type === "pen" ||
        object.type === "highlighter"
    ) {

        object.points.forEach(
            point => {

                point.x += dx;

                point.y += dy;

            }
        );

    }

    else if (
        object.type === "arrow"
    ) {

        object.start.x += dx;

        object.start.y += dy;

        object.end.x += dx;

        object.end.y += dy;

    }

    else if (
        object.type === "rectangle" ||
        object.type === "circle"
    ) {

        object.start.x += dx;

        object.start.y += dy;

        object.end.x += dx;

        object.end.y += dy;

    }

}


/* =======================================================
   SELECTION BOX
======================================================= */

function drawSelection(
    object
) {

    const bounds =
        getObjectBounds(
            object
        );


    if (
        !bounds
    ) {

        return;

    }


    ctx.save();


    ctx.setLineDash(
        [8, 6]
    );


    ctx.strokeStyle =
        "#0088ff";


    ctx.lineWidth =
        2;


    ctx.strokeRect(

        bounds.x - 10,

        bounds.y - 10,

        bounds.width + 20,

        bounds.height + 20

    );


    ctx.setLineDash([]);


    const handleSize =
        6;


    const corners = [

        {

            x:
                bounds.x - 10,

            y:
                bounds.y - 10

        },

        {

            x:
                bounds.x +
                bounds.width +
                10,

            y:
                bounds.y - 10

        },

        {

            x:
                bounds.x - 10,

            y:
                bounds.y +
                bounds.height +
                10

        },

        {

            x:
                bounds.x +
                bounds.width +
                10,

            y:
                bounds.y +
                bounds.height +
                10

        }

    ];


    corners.forEach(
        corner => {

            ctx.fillRect(

                corner.x -
                handleSize / 2,

                corner.y -
                handleSize / 2,

                handleSize,

                handleSize

            );

        }
    );


    ctx.restore();

}


/* =======================================================
   OBJECT BOUNDS
======================================================= */

function getObjectBounds(
    object
) {

    let minX =
        Infinity;


    let minY =
        Infinity;


    let maxX =
        -Infinity;


    let maxY =
        -Infinity;


    function include(
        x,
        y
    ) {

        minX =
            Math.min(
                minX,
                x
            );


        minY =
            Math.min(
                minY,
                y
            );


        maxX =
            Math.max(
                maxX,
                x
            );


        maxY =
            Math.max(
                maxY,
                y
            );

    }


    if (
        object.type === "pen" ||
        object.type === "highlighter"
    ) {

        object.points.forEach(
            point => {

                include(

                    point.x,

                    point.y

                );

            }
        );

    }

    else {

        include(

            object.start.x,

            object.start.y

        );


        include(

            object.end.x,

            object.end.y

        );

    }


    if (
        minX === Infinity ||
        minY === Infinity
    ) {

        return null;

    }


    return {

        x:
            minX,

        y:
            minY,

        width:
            maxX -
            minX,

        height:
            maxY -
            minY

    };

}


/* =======================================================
   ERASER
======================================================= */

function eraseLocal(
    position
) {

    localObjects =
        localObjects.filter(
            object => {

                return !objectHitByEraser(

                    object,

                    position,

                    eraserSize

                );

            }
        );


    if (
        movingObject &&
        !localObjects.includes(
            movingObject
        )
    ) {

        movingObject =
            null;


        movingObjectId =
            null;


        draggingSelected =
            false;


        lastMovePosition =
            null;


        movingPointerId =
            null;

    }


    renderCanvas();

}


/* =======================================================
   ERASER HIT TEST
======================================================= */

function objectHitByEraser(
    object,
    point,
    radius
) {

    if (
        object.type === "pen" ||
        object.type === "highlighter"
    ) {

        const width =
            object.type ===
                "highlighter"

                ? object.size * 4

                : object.size;


        if (
            object.points.length === 1
        ) {

            return (

                Math.hypot(

                    point.x -
                    object.points[0].x,

                    point.y -
                    object.points[0].y

                )

                <=

                radius +
                width / 2

            );

        }


        for (
            let i = 1;
            i < object.points.length;
            i++
        ) {

            if (

                distanceToSegment(

                    point,

                    object.points[i - 1],

                    object.points[i]

                )

                <=

                radius +
                width / 2

            ) {

                return true;

            }

        }

    }


    else if (
        object.type === "arrow"
    ) {

        return (

            distanceToSegment(

                point,

                object.start,

                object.end

            )

            <=

            radius +
            object.size

        );

    }


    else if (
        object.type === "rectangle"
    ) {

        return pointNearRectangle(

            point,

            object.start,

            object.end,

            radius

        );

    }


    else if (
        object.type === "circle"
    ) {

        return pointNearCircle(

            point,

            object.start,

            object.end,

            radius

        );

    }


    return false;

}


/* =======================================================
   GEOMETRY
======================================================= */

function distanceToSegment(
    point,
    start,
    end
) {

    const dx =
        end.x -
        start.x;


    const dy =
        end.y -
        start.y;


    if (
        dx === 0 &&
        dy === 0
    ) {

        return Math.hypot(

            point.x -
            start.x,

            point.y -
            start.y

        );

    }


    let t = (

        (
            point.x -
            start.x
        ) *
        dx

        +

        (
            point.y -
            start.y
        ) *
        dy

    )

        /

        (

            dx * dx +
            dy * dy

        );


    t =
        Math.max(

            0,

            Math.min(
                1,
                t
            )

        );


    const x =
        start.x +
        t * dx;


    const y =
        start.y +
        t * dy;


    return Math.hypot(

        point.x -
        x,

        point.y -
        y

    );

}


/* =======================================================
   RECTANGLE HIT TEST
======================================================= */

function pointNearRectangle(
    point,
    start,
    end,
    radius
) {

    const left =
        Math.min(
            start.x,
            end.x
        );


    const right =
        Math.max(
            start.x,
            end.x
        );


    const top =
        Math.min(
            start.y,
            end.y
        );


    const bottom =
        Math.max(
            start.y,
            end.y
        );


    const segments = [

        [

            {
                x:
                    left,

                y:
                    top

            },

            {

                x:
                    right,

                y:
                    top

            }

        ],

        [

            {

                x:
                    right,

                y:
                    top

            },

            {

                x:
                    right,

                y:
                    bottom

            }

        ],

        [

            {

                x:
                    right,

                y:
                    bottom

            },

            {

                x:
                    left,

                y:
                    bottom

            }

        ],

        [

            {

                x:
                    left,

                y:
                    bottom

            },

            {

                x:
                    left,

                y:
                    top

            }

        ]

    ];


    return segments.some(
        segment =>

            distanceToSegment(

                point,

                segment[0],

                segment[1]

            )

            <=
            radius

    );

}


/* =======================================================
   CIRCLE HIT TEST
======================================================= */

function pointNearCircle(
    point,
    start,
    end,
    radius
) {

    const left =
        Math.min(
            start.x,
            end.x
        );


    const right =
        Math.max(
            start.x,
            end.x
        );


    const top =
        Math.min(
            start.y,
            end.y
        );


    const bottom =
        Math.max(
            start.y,
            end.y
        );


    const cx =
        left +
        (right - left) /
        2;


    const cy =
        top +
        (bottom - top) /
        2;


    const rx =
        (right - left) /
        2;


    const ry =
        (bottom - top) /
        2;


    if (
        rx <= 0 ||
        ry <= 0
    ) {

        return false;

    }


    const dx =
        point.x -
        cx;


    const dy =
        point.y -
        cy;


    const normalized =
        Math.sqrt(

            (
                dx * dx
            ) /
            (
                rx * rx
            )

            +

            (
                dy * dy
            ) /
            (
                ry * ry
            )

        );


    const distance =
        Math.abs(
            normalized -
            1
        )

        *

        Math.min(
            rx,
            ry
        );


    return (
        distance <=
        radius
    );

}



/* =======================================================
   TOOL BUTTONS
======================================================= */

function registerTool(
    button,
    selectedTool
) {

    button.addEventListener(
        "pointerup",
        event => {

            event.preventDefault();

            event.stopPropagation();


            selectTool(
                selectedTool
            );

        }
    );

}


registerTool(
    penBtn,
    "pen"
);


registerTool(
    highlighterBtn,
    "highlighter"
);


registerTool(
    eraserBtn,
    "eraser"
);


registerTool(
    arrowBtn,
    "arrow"
);


registerTool(
    rectangleBtn,
    "rectangle"
);


registerTool(
    circleBtn,
    "circle"
);


/* =======================================================
   COLOR
======================================================= */

colorPicker.addEventListener(
    "input",
    event => {

        event.stopPropagation();


        color =
            colorPicker.value;


        colorPreview.style.background =
            color;


        sendCommand(
            "color",
            color
        );

    }
);


/* =======================================================
   SIZE
======================================================= */

sizeSlider.addEventListener(
    "input",
    event => {

        event.stopPropagation();


        const value =
            Number(
                sizeSlider.value
            );


        if (
            tool === "eraser"
        ) {

            eraserSize =
                value;


            sizeValue.textContent =
                eraserSize;


            sendCommand(

                "eraser_size",

                eraserSize

            );

        }

        else {

            brushSize =
                value;


            sizeValue.textContent =
                brushSize;


            sendCommand(

                "size",

                brushSize

            );

        }

    }
);


/* =======================================================
   UNDO
======================================================= */

undoBtn.addEventListener(
    "pointerup",
    event => {

        event.preventDefault();

        event.stopPropagation();


        if (
            localObjects.length > 0
        ) {

            localObjects.pop();

        }


        movingObject =
            null;


        movingObjectId =
            null;


        draggingSelected =
            false;


        lastMovePosition =
            null;


        movingPointerId =
            null;


        pendingObjectTap =
            null;


        renderCanvas();


        sendCommand(
            "undo"
        );

    }
);


/* =======================================================
   CLEAR
======================================================= */

clearBtn.addEventListener(
    "pointerup",
    event => {

        event.preventDefault();

        event.stopPropagation();


        localObjects =
            [];


        currentStroke =
            null;


        currentShape =
            null;


        movingObject =
            null;


        movingObjectId =
            null;


        draggingSelected =
            false;


        lastMovePosition =
            null;


        movingPointerId =
            null;


        pendingObjectTap =
            null;


        renderCanvas();


        sendCommand(
            "clear"
        );

    }
);


/* =======================================================
   SCREEN
======================================================= */

screenBtn.addEventListener(
    "pointerup",
    event => {

        event.preventDefault();

        event.stopPropagation();

        console.log(
            "Screen preview button pressed."
        );

        toggleScreenPreview();

    }
);


/* =======================================================
   EXIT
======================================================= */

exitBtn.addEventListener(
    "pointerup",
    event => {

        event.preventDefault();
        event.stopPropagation();

        console.log(
            "Returning to Home screen."
        );

        // Prevent automatic WebSocket reconnect
        manualClose = true;

        // Stop screen streaming
        closeScreenPreview();

        // Close WebSocket connection
        if (ws) {

            const oldSocket = ws;

            ws = null;

            if (
                oldSocket.readyState ===
                    WebSocket.OPEN ||
                oldSocket.readyState ===
                    WebSocket.CONNECTING
            ) {

                try {

                    oldSocket.close(
                        1000,
                        "Returning Home"
                    );

                } catch (error) {

                    console.log(
                        "Error closing WebSocket:",
                        error
                    );

                }

            }

        }

        // Update connection state
        updateHomeConnectionState(
            false
        );

        updateHomeConnectionMessage(
            "Not Connected",
            "🔴"
        );

    if (connectionStatus) {
    connectionStatus.innerHTML =
        "⚪ <span>Not Connected</span>";
}

        // Return to Home
        showHomeScreen();

    }
);

/* =========================================================
   PC CONNECTION UI
========================================================= */

if (
    pcIPInput
) {

    /*
    Show previously saved PC IP.
    */

    pcIPInput.value =
        screenPenIP || "";

}


/* =========================================================
   CONNECT BUTTON
========================================================= */

if (connectPCBtn) {
    connectPCBtn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const ip = pcIPInput
            ? pcIPInput.value.trim()
            : "";

        console.log(
            "IP entered:",
            ip
        );

        connectToPC(ip);
    });
}


/* =========================================================
   ENTER KEY IN IP INPUT
========================================================= */

if (
    pcIPInput
) {

    pcIPInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();


                const ip =
                    pcIPInput.value.trim();


                connectToPC(
                    ip
                );

            }

        }
    );

}


/* =========================================================
   LOCAL MODE BUTTON
========================================================= */

if (
    localModeBtn
) {

    localModeBtn.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            enterLocalMode();

        }
    );

}

/* =======================================================
   STAGE 1 HOME BUTTONS
======================================================= */

if(downloadPCBtn){
    downloadPCBtn.addEventListener(
        "click",
        event=>{
            event.preventDefault();
            event.stopPropagation();
            showSetupGuide();
        }
    );
}

if(setupBackBtn){
    setupBackBtn.addEventListener(
        "click",
        event=>{
            event.preventDefault();
            showHomeScreen();
        }
    );
}

if(setupBackHomeBtn){
    setupBackHomeBtn.addEventListener(
        "click",
        event=>{
            event.preventDefault();
            showHomeScreen();
        }
    );
}

if(scanQRBtn){
    scanQRBtn.addEventListener(
        "click",
        async event=>{
            event.preventDefault();
            event.stopPropagation();

            openQRPanel();

            await scanScreenPenQR();
        }
    );
}

if(manualIPBtn){
    manualIPBtn.addEventListener(
        "click",
        event=>{
            event.preventDefault();
            openManualIPPanel();

            if(pcIPInput){
                pcIPInput.focus();
            }
        }
    );
}


/* =======================================================
   INITIALIZATION
======================================================= */

function initialize(){

    /*
    Prevent browser scrolling/zooming from interfering
    with drawing.
    */

    canvas.style.touchAction = "none";


    /*
    Initialize color.
    */

    color =
        colorPicker.value ||
        "#ff0000";

    colorPreview.style.background =
        color;


    /*
    Initialize brush size.
    */

    brushSize =
        Number(
            sizeSlider.value
        ) || 5;

    sizeValue.textContent =
        String(
            brushSize
        );


    /*
    Initialize the active drawing tool
    and size controls.
    */

    updateActiveTool();
    updateSizeControl();


    /*
    Resize the drawing canvas.
    */

    resizeCanvas();


    /*
    Restore the previously saved Windows PC IP.

    Do NOT connect automatically.
    The user must press Connect.
    */

    if(screenPenIP){

        console.log(
            "Saved ScreenPen PC IP:",
            screenPenIP
        );

        if(pcIPInput){

            pcIPInput.value =
                screenPenIP;

        }

    }else{

        console.log(
            "No saved ScreenPen PC IP."
        );

    }


    /*
    Initial connection status.
    */

   if (connectionStatus) {
    connectionStatus.innerHTML =
        "🔴 <span>Not Connected</span>";
}
    /*
    Make sure the Home screen shows
    the correct disconnected state.
    */

    updateHomeConnectionState(false);


    /*
    Show the Home screen when the app starts.
    */

    showHomeScreen();


    /*
    Open the manual PC IP connection panel.
    */

    openManualIPPanel();


    /*
    Startup logs.
    */

    console.log(
        "ScreenPen loaded."
    );

    console.log(
        "Double-tap an object to select it."
    );

    console.log(
        "After selection, drag from inside the object to move it."
    );
}


initialize();