const { getDriver, ToolbarID } = require("./import");
const { By } = require("selenium-webdriver");

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

const runScript = async (cb, ...args) => {
    const driver = await getDriver();
    return await driver.executeScript(cb, ...args);
};

const runAsyncScript = async (cb, ...args) => {
    const driver = await getDriver();
    return await driver.executeAsyncScript(cb, ...args);
};

const findClosestResourcePatch = async (resource, tileX, tileY) => {
    return await runAsyncScript(
        (resource, tileX, tileY, cb) => {
            const startChunk = tileToChunk(tileX, tileY);
        },
        resource,
        tileX,
        tileY
    );
};

const clickToolbar = async item => {
    const index = hudItems.indexOf(item) + 1;

    if (index === 0) {
        // if indexOf gave back -1, that's when this'll be 0. it should start with 1.
        throw new Error(`HUD Item '${item}' does not exist.`);
    }

    const driver = await getDriver();
    await driver.findElement(By.css(`#${ToolbarID} .buildings :nth-child(${index})`)).click();
};

const clickTile = async (tileX, tileY) => {
    await runAsyncScript(
        (tileX, tileY, cb) => {
            clickTile(tileX, tileY);
            window.requestAnimationFrame(cb);
        },
        tileX,
        tileY
    );
};

exports.timeout = async ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

exports.clickToolbar = clickToolbar;
exports.clickTile = clickTile;
exports.runScript = runScript;
exports.runAsyncScript = runAsyncScript;
