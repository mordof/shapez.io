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

const enumDirection = {
    top: "top",
    right: "right",
    bottom: "bottom",
    left: "left",
};

const enumInvertedDirections = {
    [enumDirection.top]: enumDirection.bottom,
    [enumDirection.right]: enumDirection.left,
    [enumDirection.bottom]: enumDirection.top,
    [enumDirection.left]: enumDirection.right,
};

const enumDirectionToAngle = {
    [enumDirection.top]: 0,
    [enumDirection.right]: 90,
    [enumDirection.bottom]: 180,
    [enumDirection.left]: 270,
};

const enumAngleToDirection = {
    0: enumDirection.top,
    90: enumDirection.right,
    180: enumDirection.bottom,
    270: enumDirection.left,
};

const toolVariantMax = {
    belt: 1,
    splitter: 3,
    underground_belt: 2,
    miner: 2,
    cutter: 2,
    rotator: 2,
    stacker: 1,
    mixer: 1,
    painer: 4,
    trash: 2,
};

const toolVariants = {};
const toolRotations = {};

const runScript = async (cb, ...args) => {
    const driver = await getDriver();
    return await driver.executeScript(cb, ...args);
};

const runAsyncScript = async (cb, ...args) => {
    const driver = await getDriver();
    return await driver.executeAsyncScript(cb, ...args);
};

const getEntityAtTile = async (tileX, tileY) => {
    return await runAsyncScript(
        (tileX, tileY, cb) => {
            getEntityAtTile(tileX, tileY).then(e => {
                let { root: root1, ...entity } = e;
                if (entity.components.Belt) {
                    // BeltPath has a root reference we need to remove
                    // in order to do that we need to completely rebuild
                    // the object in that area so as to not damage the original
                    // operating entity in the game
                    entity.components = { ...entity.components };
                    entity.components.Belt = { ...entity.components.Belt };

                    // entityPath is circular references to the belts in the path.
                    // ignoring this unless it's needed later, then we'll need to
                    // figure out a better way to deal with that.
                    let { root: root2, entityPath, ...assignedPath } = entity.components.Belt.assignedPath;
                    entity.components.Belt.assignedPath = assignedPath;
                }
                cb(entity);
            });
        },
        tileX,
        tileY
    );
};

const findClosestResourcePatch = async (resource, tileX, tileY, sortClosestToCenter = true) => {
    const patch = await runAsyncScript(
        (resource, tileX, tileY, cb) => {
            const chunkSize = getConfig().chunkSize;
            const startChunk = tileToChunk(tileX, tileY);
            const lookingForShape = resource.shape !== undefined;
            const lookingForColor = resource.color !== undefined;

            const patchItems = new Map();

            spiralSearchChunks(startChunk.x, startChunk.y, async chunk => {
                let successfulChunk = false;

                for (let x = 0; x < chunkSize; x++) {
                    for (let y = 0; y < chunkSize; y++) {
                        const tileItem = chunk.lowerLayer[x][y];

                        if (tileItem === undefined) continue;

                        if (
                            (lookingForShape &&
                                tileItem.definition &&
                                tileItem.definition.cachedHash === resource.shape) ||
                            (lookingForColor && tileItem.color === resource.color)
                        ) {
                            successfulChunk = true;
                            patchItems.set(new Vector(x + chunk.tileX, y + chunk.tileY), tileItem);
                        }
                    }
                }

                return successfulChunk;
            }).then(() => {
                cb(Array.from(patchItems.entries()));
            });
        },
        resource,
        tileX,
        tileY
    );

    if (sortClosestToCenter) {
        patch.sort((a, b) => {
            const aDist = Math.sqrt(a[0].x * a[0].x + a[0].y * a[0].y);
            const bDist = Math.sqrt(b[0].x * b[0].x + b[0].y * b[0].y);
            return aDist - bDist;
        });
    }

    return patch;
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

const changeVariantTo = async (tool, variant) => {
    const max = toolVariantMax[tool];

    if (max === 1) return; // there's only 1 variant. nothing to do.

    const toolVariant = toolVariants[tool] || 1;
    let timesToChange = 0;

    if (variant < toolVariant) {
        timesToChange = max - toolVariant + variant;
    } else if (variant > toolVariant) {
        timesToChange = variant - toolVariant;
    }

    if (timesToChange > 0) {
        await runScript(times => {
            for (let i = 0; i < times; i++) {
                hitKey("t");
            }
        }, timesToChange);
        toolVariants[tool] = variant;
    }
};

const rotateItemTo = async (tool, direction) => {
    const toolRotation = toolRotations[tool] || 0;

    const timesToRotate = (enumDirectionToAngle[direction] - toolRotation) / 90;

    if (timesToRotate !== 0) {
        await runScript(
            (times, holdShift) => {
                for (let i = 0; i < times; i++) {
                    hitKey("r", holdShift);
                }
            },
            Math.abs(timesToRotate),
            timesToRotate < 0
        );
        toolRotations[tool] = enumDirectionToAngle[direction];
    }
};

const placeItem = async (tool, tileX, tileY, facing = "top", variant = 0) => {
    await clickToolbar(tool);
    await rotateItemTo(tool, facing);
    await changeVariantTo(tool, variant);
    await clickTile(tileX, tileY);
};

const getHubGoals = async () => {
    return await runScript(() => {
        const { root, ...goals } = globalRoot.hubGoals;
        return goals;
    });
};

const dragBelt = async (fromTileX, fromTileY, toTileX, toTileY) => {
    await clickToolbar("belt");
    await runAsyncScript(
        (fromTileX, fromTileY, toTileX, toTileY, cb) => {
            const fromScreenSpace = tileToScreenSpace(fromTileX, fromTileY);
            const toScreenSpace = tileToScreenSpace(toTileX, toTileY);
            mouseDown(fromScreenSpace.x, fromScreenSpace.y);
            moveMouse(fromScreenSpace.x, toScreenSpace.y);
            window.requestAnimationFrame(() => {
                moveMouse(toScreenSpace.x, toScreenSpace.y);
                window.requestAnimationFrame(() => {
                    mouseUp();
                    cb();
                });
            });
        },
        fromTileX,
        fromTileY,
        toTileX,
        toTileY
    );
};

exports.timeout = async ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

exports.clickToolbar = clickToolbar;
exports.clickTile = clickTile;
exports.runScript = runScript;
exports.runAsyncScript = runAsyncScript;
exports.findClosestResourcePatch = findClosestResourcePatch;
exports.placeItem = placeItem;
exports.dragBelt = dragBelt;
exports.getHubGoals = getHubGoals;
exports.getEntityAtTile = getEntityAtTile;
