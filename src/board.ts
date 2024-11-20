/*// Board.ts for Flyweight pattern

import leaflet from "leaflet";

interface Cell {
    readonly i: number;
    readonly j: number;
}

export class Board {

    readonly tileWidth: number;
    readonly tileVisibilityRadius: number;

    private readonly knownCells: Map<string, Cell>;

    constructor(tileWidth: number, tileVisibilityRadius: number) {
        // ...
    }

    private getCanonicalCell(cell: Cell): Cell {
        const { i, j } = cell;
        const key = [i, j].toString();
        // ...
        return this.knownCells.get(key)!;
    }

    getCellForPoint(point: leaflet.LatLng): Cell {
        return this.getCanonicalCell({
            // ...
        });
    }

    getCellBounds(cell: Cell): leaflet.LatLngBounds {
    	// ...
    }

    getCellsNearPoint(point: leaflet.LatLng): Cell[] {
        const resultCells: Cell[] = [];
        const originCell = this.getCellForPoint(point);
        // ...
        return resultCells;
    }
}*/
