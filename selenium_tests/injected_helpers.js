module.exports = () => {
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

    window.hitKey = (key, holdShift = false) => {
        if (holdShift) {
            const shiftDownEvent = new Event("keydown");
            shiftDownEvent.keyCode = 16;
            window.dispatchEvent(shiftDownEvent);
        }

        const keyDownEvent = new Event("keydown");
        keyDownEvent.keyCode = key.toUpperCase().charCodeAt(0);
        window.dispatchEvent(keyDownEvent);

        const keyUpEvent = new Event("keyup");
        keyUpEvent.keyCode = key.toUpperCase().charCodeAt(0);
        window.dispatchEvent(keyUpEvent);

        if (holdShift) {
            const shiftUpEvent = new Event("keyup");
            shiftUpEvent.keyCode = 16;
            window.dispatchEvent(shiftUpEvent);
        }
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

    window.getEntityAtTile = async (tileX, tileY) => {
        const chunk = await getChunk(tileToChunk(tileX, tileY));
        const offsetX = tileX - chunk.tileX;
        const offsetY = tileY - chunk.tileY;

        return chunk.contents[offsetX][offsetY];
    };

    window.getChunk = async chunkVector => {
        let chunk = globalRoot.map.chunksById.get(vecToCoordID(chunkVector));

        if (chunk === undefined) {
            // chunk isn't loaded. we need to move the camera there
            // so it'll load the chunk.
            const tileXY = chunkToTile(chunkVector.x, chunkVector.y);
            await moveCameraToTile(tileXY.x, tileXY.y, true);
            chunk = globalRoot.map.chunksById.get(vecToCoordID(chunkVector));
        }

        return chunk;
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
            const chunk = await getChunk(cur);

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
