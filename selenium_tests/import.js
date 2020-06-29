const { Builder, By, Key, until, logging } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { timeout } = require("./helpers");

const Toolbar = "ingame_HUD_buildings_toolbar";
const EntityInspector = "ingame_HUD_EntityDebugger";
const Tutorial = "ingame_HUD_InteractiveTutorial";
const KeyBindings = "ingame_HUD_KeybindingOverlay";
const Notifications = "ingame_HUD_Notifications";
const PinnedShapes = "ingame_HUD_PinnedShapes";
const PlacementHints = "ingame_HUD_PlacementHints";
const PlacerVariants = "ingame_HUD_PlacerVariants";

const hudItems = [
    "belt",
    "splitter",
    "underground_belt",
    "miner",
    "cutter",
    "rotator",
    "stacker",
    "mixer",
    "painter",
    "trash",
];

let options = new chrome.Options();
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
options.setLoggingPrefs(prefs);
options.addArguments("--auto-open-devtools-for-tabs");

let driverCache;
let tileInfo;
let tileInfoDirty = false;

const moveMouse = async (x, y) => {
    const driver = await getDriver();
    await driver.executeAsyncScript(
        (x, y, cb) => {
            moveMouse(x, y);
            window.requestAnimationFrame(cb);
        },
        x,
        y
    );
};

const clickToolbar = async item => {
    const index = hudItems.indexOf(item) + 1;

    if (index === 0) {
        // if indexOf gave back -1, that's when this'll be 0. it should start with 1.
        throw new Error(`HUD Item '${item}' does not exist.`);
    }

    const driver = await getDriver();
    await driver.findElement(By.css(`#${Toolbar} .buildings :nth-child(${index})`)).click();
};

const clickTile = async (tileX, tileY) => {
    const xy = getXYForTileXY(tileX, tileY);

    const driver = await getDriver();
    await driver.executeAsyncScript(
        (x, y, cb) => {
            moveMouse(x, y);
            clickMouse(x, y);
            window.requestAnimationFrame(cb);
        },
        xy.x,
        xy.y
    );
};

const getXYForTileXY = (tileX, tileY, center = true) => {
    if (tileInfo === undefined) {
        throw new Error("Must call `getTileInfo` first");
    }

    let xToCenter;
    let yToCenter;

    if (tileInfo.topLeftTileX < 0) {
        xToCenter = tileInfo.offsetX + Math.abs(tileInfo.topLeftTileX + 1) * tileInfo.width;
    } else {
        xToCenter = -(tileInfo.width - tileInfo.offsetX - tileInfo.topLeftTileX * tileInfo.width);
    }
    if (tileInfo.topLeftTileY < 0) {
        yToCenter = tileInfo.offsetY + Math.abs(tileInfo.topLeftTileY + 1) * tileInfo.height;
    } else {
        yToCenter = -(tileInfo.height - tileInfo.offsetY - tileInfo.topLeftTileY * tileInfo.height);
    }

    return {
        x: xToCenter + tileX * tileInfo.width + (center ? tileInfo.width / 2 : 0),
        y: yToCenter + tileY * tileInfo.height + (center ? tileInfo.height / 2 : 0),
    };
};

const getTileInfo = async () => {
    if (tileInfo && tileInfoDirty === false) {
        return tileInfo;
    }

    const driver = await getDriver();
    tileInfo = await driver.executeAsyncScript(cb => {
        let tileWidth = 0;
        let tileHeight = 0;

        let tileOffsetX = 0;
        let tileOffsetY = 0;

        let topLeftTileX = 0;
        let topLeftTileY = 0;

        async function findTileDetails(cb) {
            let curX = 0;
            let curY = 0;
            let curTileX;
            let curTileY;

            let hasFoundLeft = false;
            let hasFoundTop = false;

            let hasFoundWidth = false;
            let hasFoundHeight = false;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                moveMouse(curX, curY);
                await waitForFrame();
                const [tileX, tileY] = getCurrentTile();

                if (curTileX !== undefined && curTileY !== undefined) {
                    if (!hasFoundWidth && tileX === curTileX) {
                        tileWidth++;
                    }
                    if (!hasFoundHeight && tileY === curTileY) {
                        tileHeight++;
                    }

                    if (tileX !== curTileX) {
                        if (hasFoundLeft === false) {
                            tileOffsetX = tileWidth;
                            tileWidth = 0;
                            hasFoundLeft = true;
                            curTileX = tileX;
                        } else {
                            hasFoundWidth = true;
                        }
                    }
                    if (tileY !== curTileY) {
                        if (hasFoundTop === false) {
                            tileOffsetY = tileHeight;
                            tileHeight = 0;
                            hasFoundTop = true;
                            curTileY = tileY;
                        } else {
                            hasFoundHeight = true;
                        }
                    }
                } else {
                    topLeftTileX = tileX;
                    topLeftTileY = tileY;
                    curTileX = tileX;
                    curTileY = tileY;
                }

                if (hasFoundWidth && hasFoundHeight) {
                    break;
                }

                curX++;
                curY++;
            }

            cb();
        }

        findTileDetails(() => {
            cb({
                offsetX: tileOffsetX,
                offsetY: tileOffsetY,
                width: tileWidth,
                height: tileHeight,
                tileCountX: (window.innerWidth - tileOffsetX) / tileWidth + tileOffsetX / tileWidth,
                tileCountY: (window.innerHeight - tileOffsetY) / tileHeight + tileOffsetY / tileHeight,
                topLeftTileX,
                topLeftTileY,
            });
        });
    });

    return tileInfo;
};

const getDriver = async () => {
    if (driverCache) return driverCache;
    driverCache = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    driverCache.manage().window().maximize();
    return driverCache;
};

const injectHelpers = inspectorID => {
    const canvas = document.querySelector("canvas");

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

    window.getCurrentTile = () => {
        const mousePos = document.querySelector(`#${inspectorID} .mousePos`).textContent;
        return mousePos.split(" / ").map(pos => parseFloat(pos));
    };
};

const loadCleanPage = async () => {
    tileInfoDirty = true;
    const driver = await getDriver();
    await driver.get("http://localhost:3005");
    await Promise.all([
        driver.wait(until.elementLocated(By.id(Toolbar)), 2000),
        driver.wait(until.elementLocated(By.id(Tutorial)), 2000),
        driver.wait(until.elementLocated(By.id(EntityInspector)), 2000),
        driver.wait(until.elementLocated(By.id(KeyBindings)), 2000),
        driver.wait(until.elementLocated(By.id(Notifications)), 2000),
        driver.wait(until.elementLocated(By.id(PinnedShapes)), 2000),
    ]);
    await driver.executeScript(
        (tutorialID, keyBindingsID, notificationsID, pinnedShapesID, inspectorID, hintsID, variantsID) => {
            const styles = `
                #${tutorialID}, 
                #${keyBindingsID}, 
                #${notificationsID}, 
                #${pinnedShapesID},
                #${inspectorID},
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
        EntityInspector,
        PlacementHints,
        PlacerVariants
    );
    await driver.executeScript(injectHelpers, EntityInspector);
    await getTileInfo();
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
exports.getTileInfo = getTileInfo;
exports.clickToolbar = clickToolbar;
exports.clickTile = clickTile;
