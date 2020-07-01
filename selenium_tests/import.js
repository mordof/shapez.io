const { Builder, By, until, logging } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const Toolbar = "ingame_HUD_buildings_toolbar";
const Tutorial = "ingame_HUD_InteractiveTutorial";
const KeyBindings = "ingame_HUD_KeybindingOverlay";
const Notifications = "ingame_HUD_Notifications";
const PinnedShapes = "ingame_HUD_PinnedShapes";
const PlacementHints = "ingame_HUD_PlacementHints";
const PlacerVariants = "ingame_HUD_PlacerVariants";

exports.ToolbarID = Toolbar;

let options = new chrome.Options();
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
options.setLoggingPrefs(prefs);
options.addArguments("--auto-open-devtools-for-tabs");

let driverCache;

const getDriver = async () => {
    if (driverCache) return driverCache;
    driverCache = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    driverCache.manage().window().maximize();
    return driverCache;
};

const injectHelpers = () => {
    const canvas = document.querySelector("canvas");
    const Vector = globalRoot.camera.center.constructor;
    let config;

    window.timeout = async ms => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    window.getConfig = () => {
        if (config) return config;

        const conf = {};
        conf.chunkSize = globalRoot.map.chunksById.get("0|0").lowerLayer.length;

        config = conf;
        return config;
    };

    window.waitForFrame = async () => {
        await new Promise(resolve => window.requestAnimationFrame(resolve));
    };

    window.testLog = (...args) => {
        console.log("TESTLOG:", ...args);
    };

    window.clickMouse = (x, y) => {
        let mousedownEvent = new Event("mousedown");
        mousedownEvent.pageX = x;
        mousedownEvent.pageY = y;
        mousedownEvent.clientX = x;
        mousedownEvent.clientY = y;
        mousedownEvent.offsetX = x;
        mousedownEvent.offsetY = y;
        mousedownEvent.button = 0;
        canvas.dispatchEvent(mousedownEvent);

        const mouseupEvent = new Event("mouseup");
        mouseupEvent.pageX = x;
        mouseupEvent.pageY = y;
        mouseupEvent.clientX = x;
        mouseupEvent.clientY = y;
        mouseupEvent.offsetX = x;
        mouseupEvent.offsetY = y;
        mouseupEvent.button = 0;
        window.dispatchEvent(mouseupEvent);
    };

    window.tileToPos = (tileX, tileY) => {
        const worldPos = new Vector(tileX, tileY).toWorldSpaceCenterOfTile();
        return globalRoot.camera.worldToScreen(worldPos);
    };

    window.tileToChunk = (tileX, tileY) => {
        const chunkSize = getConfig().chunkSize;
        return new Vector(
            ((tileX / chunkSize) | 0) - (tileX < 0 ? 1 : 0),
            ((tileY / chunkSize) | 0) - (tileY < 0 ? 1 : 0)
        );
    };

    window.chunkToTile = (chunkX, chunkY) => {
        const chunkSize = getConfig().chunkSize;
        return new Vector(chunkX * chunkSize, chunkY * chunkSize);
    };

    window.cameraToTile = async (tileX, tileY, waitUntilDone) => {
        const screenPos = tileToPos(tileX, tileY);
        globalRoot.camera.currentPan = screenPos;

        if (waitUntilDone) {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                await timeout(50);

                if (globalRoot.camera.currentlyMoving === false) {
                    break;
                }
            }
        }
    };

    window.spiralSearchChunks = async (chunkX, chunkY, testCB) => {
        const startChunkX = chunkX;
        const startChunkY = chunkY;
        let curX = chunkX;
        let curY = chunkY;
        let spiralIter = 0;
        let dirX = 1;
        let dirY = 0;

        let checkLimitIter = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let chunk = globalRoot.map.chunksById.get(`${curX}|${curY}`);

            if (chunk === undefined) {
                const tileXY = chunkToTile(curX, curY);
                await cameraToTile(tileXY.x, tileXY.y, true);
                chunk = globalRoot.map.chunksById.get(`${curX}|${curY}`);
            }

            const result = await new Promise(resolve => testCB(chunk, resolve));

            checkLimitIter++;

            if (checkLimitIter > 1000) break;
        }
    };

    window.clickTile = (tileX, tileY) => {
        const screenPos = tileToPos(tileX, tileY);
        moveMouse(screenPos.x, screenPos.y);
        clickMouse(screenPos.x, screenPos.y);
    };

    window.moveMouseToTile = (tileX, tileY) => {
        const screenPos = tileToPos(tileX, tileY);
        moveMouse(screenPos.x, screenPos.y);
    };

    window.moveMouse = (x, y) => {
        const ev = new Event("mousemove");
        ev.pageX = x;
        ev.pageY = y;
        ev.clientX = x;
        ev.clientY = y;
        ev.offsetX = x;
        ev.offsetY = y;
        window.dispatchEvent(ev);
    };
};

const loadCleanPage = async () => {
    const driver = await getDriver();
    await driver.get("http://localhost:3005");
    await Promise.all([
        driver.wait(until.elementLocated(By.id(Toolbar)), 2000),
        driver.wait(until.elementLocated(By.id(Tutorial)), 2000),
        driver.wait(until.elementLocated(By.id(KeyBindings)), 2000),
        driver.wait(until.elementLocated(By.id(Notifications)), 2000),
        driver.wait(until.elementLocated(By.id(PinnedShapes)), 2000),
    ]);
    await driver.executeScript(
        (tutorialID, keyBindingsID, notificationsID, pinnedShapesID, hintsID, variantsID) => {
            const styles = `
                #${tutorialID}, 
                #${keyBindingsID}, 
                #${notificationsID}, 
                #${pinnedShapesID},
                #${hintsID},
                #${variantsID} {
                    display: none;
                }
            `;

            const css = document.createElement("style");
            css.type = "text/css";

            if (css.styleSheet) css.styleSheet.cssText = styles;
            else css.appendChild(document.createTextNode(styles));

            document.getElementsByTagName("head")[0].appendChild(css);
        },
        Tutorial,
        KeyBindings,
        Notifications,
        PinnedShapes,
        PlacementHints,
        PlacerVariants
    );
    await driver.executeScript(injectHelpers);
    return driver;
};

beforeEach(async () => {
    await loadCleanPage();
});

afterEach(async () => {
    const driver = await getDriver();
    await driver
        .manage()
        .logs()
        .get(logging.Type.BROWSER)
        .then(logs => {
            // So that we can place logs inside of the browser, and see them once the
            // tests are done... however if we don't filter these, we'll end up with
            // absolutely all of shapez.io logs as well making it hard to find ours.
            const testLogs = logs.filter(log => log.message.includes("TESTLOG:"));
            if (testLogs.length > 0) {
                console.log(testLogs);
            }
        });
});

beforeAll(async () => {
    // ridiculous timeout. will be tuned later but for now prevents jest shutting
    // down tests early
    jest.setTimeout(100000000);
    const driver = await getDriver();
});

afterAll(async () => {
    const driver = await getDriver();
    await driver.quit();
});

exports.getDriver = getDriver;
exports.loadCleanPage = loadCleanPage;
