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
    window.Vector = globalRoot.camera.center.constructor;
    let config;

    window.timeout = async ms => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    window.waitFor = async (cb, ms) => {
        await new Promise(resolve => {
            const hndl = setInterval(() => {
                if (cb()) {
                    clearInterval(hndl);
                    resolve();
                }
            }, ms);
        });
    };

    window.waitForFrame = async () => {
        await new Promise(resolve => window.requestAnimationFrame(resolve));
    };

    window.getConfig = () => {
        if (config) return config;

        const conf = {};
        conf.chunkSize = globalRoot.map.chunksById.get("0|0").lowerLayer.length;

        config = conf;
        return config;
    };

    window.testLog = (...args) => {
        console.log("TESTLOG:", ...args);
    };

    window.hitKey = key => {
        const keyDownEvent = new Event("keydown");
        keyDownEvent.keyCode = key.toUpperCase().charCodeAt(0);
        window.dispatchEvent(keyDownEvent);

        const keyUpEvent = new Event("keyup");
        keyUpEvent.keyCode = key.toUpperCase().charCodeAt(0);
        window.dispatchEvent(keyUpEvent);
    };

    window.mouseDown = (x, y) => {
        const mouseDownEvent = new Event("mousedown");
        mouseDownEvent.pageX = x;
        mouseDownEvent.pageY = y;
        mouseDownEvent.clientX = x;
        mouseDownEvent.clientY = y;
        mouseDownEvent.offsetX = x;
        mouseDownEvent.offsetY = y;
        mouseDownEvent.button = 0;
        canvas.dispatchEvent(mouseDownEvent);
    };

    window.mouseUp = (x, y) => {
        const mouseUpEvent = new Event("mouseup");
        mouseUpEvent.pageX = x;
        mouseUpEvent.pageY = y;
        mouseUpEvent.clientX = x;
        mouseUpEvent.clientY = y;
        mouseUpEvent.offsetX = x;
        mouseUpEvent.offsetY = y;
        mouseUpEvent.button = 0;
        window.dispatchEvent(mouseUpEvent);
    };

    window.clickMouse = (x, y) => {
        mouseDown(x, y);
        mouseUp(x, y);
    };

    window.coordIDToVec = id => {
        const arr = id.split("|").map(parseFloat);
        return new Vector(arr[0], arr[1]);
    };

    window.vecToCoordID = vec => {
        return `${vec.x}|${vec.y}`;
    };

    window.tileToWorldSpace = (tileX, tileY) => {
        return new Vector(tileX, tileY).toWorldSpaceCenterOfTile();
    };

    window.tileToScreenSpace = (tileX, tileY) => {
        return globalRoot.camera.worldToScreen(tileToWorldSpace(tileX, tileY));
    };

    window.tileToChunk = (tileX, tileY) => {
        const chunkSize = getConfig().chunkSize;
        return new Vector(
            ((tileX / chunkSize) | 0) - (tileX < 0 ? 1 : 0),
            ((tileY / chunkSize) | 0) - (tileY < 0 ? 1 : 0)
        );
    };

    window.chunkToTile = (chunkX, chunkY, center = true) => {
        const chunkSize = getConfig().chunkSize;
        return new Vector(
            chunkX * chunkSize + (center ? chunkSize / 2 : 0),
            chunkY * chunkSize + (center ? chunkSize / 2 : 0)
        );
    };

    window.moveCameraToTile = async (tileX, tileY, waitUntilDone) => {
        const screenPos = tileToWorldSpace(tileX, tileY).floor();
        globalRoot.camera.desiredCenter = screenPos;

        if (waitUntilDone) {
            await waitFor(() => globalRoot.camera.desiredCenter === null, 50);
        }
    };

    window.spiralSearchChunks = async (chunkX, chunkY, testCB) => {
        const startChunk = new Vector(chunkX, chunkY);
        let cur = new Vector(chunkX, chunkY);
        let spiralStart = new Vector(chunkX, chunkY);
        let spiralIter = 0;

        let dirI = 0;
        const dirs = [
            new Vector(0, 0), // used for very beginning to go nowhere
            new Vector(0, -1), // go up (spiral starts to the left of the last one, so we go up)
            new Vector(1, 0), // go right
            new Vector(0, 1), // go down
            new Vector(-1, 0), // go left
            new Vector(0, -1), // finish off spiral by going up again
        ];

        let checkLimitIter = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let chunk = globalRoot.map.chunksById.get(vecToCoordID(cur));

            if (chunk === undefined) {
                // chunk isn't loaded. we need to move the camera there
                // so it'll load the chunk.
                const tileXY = chunkToTile(cur.x, cur.y);
                await moveCameraToTile(tileXY.x, tileXY.y, true);
                chunk = globalRoot.map.chunksById.get(vecToCoordID(cur));
            }

            const result = await testCB(chunk);

            if (result) {
                // we found what we're looking for
                break;
            }

            cur.addInplace(dirs[dirI]);

            if (Math.abs(cur.x - startChunk.x) > spiralIter || Math.abs(cur.y - startChunk.y) > spiralIter) {
                // we've finished this stretch of the spiral path. time to bring it back
                // in and change direction
                cur.subInplace(dirs[dirI]);
                dirI += 1;
                cur.addInplace(dirs[dirI]);
            }

            if (cur.equals(spiralStart)) {
                // back at the beginning of the spiral. Time to start the next spiral
                spiralIter += 1;
                dirI = 1;
                cur.addInplace(new Vector(-1, 0));
                spiralStart = cur.copy();
            }

            checkLimitIter++;

            if (checkLimitIter > 1000) break;
        }
    };

    window.clickTile = (tileX, tileY) => {
        const screenPos = tileToScreenSpace(tileX, tileY);
        moveMouse(screenPos.x, screenPos.y);
        clickMouse(screenPos.x, screenPos.y);
    };

    window.moveMouseToTile = (tileX, tileY) => {
        const screenPos = tileToScreenSpace(tileX, tileY);
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
