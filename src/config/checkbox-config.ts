export const CHECKBOX_CONFIG: Record<string, Record<string, boolean>> = {
    "quote": {
        "picture": true,
        "partName": true,
        "partNumber": true,
        "quantity": true,
        "unitQuantity": false,
        "material": true,
        "thickness": true,
        "notes": false,
        "component-notes": false,
        "price": true,
        "unitPrice": true,
        "shelfNumber": false,
        "process": false,
        "paint": true,
        "dimensions": true,
        "cuttingTime": true,
        "nestCutTime": true,
        "nestName": true,
        "show-total-cost": true,
        "show-assemblyPicture": false,
    },
    "workorder": {
        "picture": true,
        "partName": true,
        "partNumber": true,
        "quantity": true,
        "unitQuantity": false,
        "material": true,
        "thickness": true,
        "notes": false,
        "component-notes": true,
        "price": false,
        "unitPrice": false,
        "shelfNumber": false,
        "process": true,
        "paint": true,
        "dimensions": true,
        "cuttingTime": true,
        "nestCutTime": true,
        "nestName": true,
        "show-total-cost": false,
        "show-assemblyPicture": true,
    },
    "packingslip": {
        "picture": true,
        "partName": true,
        "partNumber": true,
        "quantity": true,
        "unitQuantity": false,
        "material": true,
        "thickness": true,
        "notes": false,
        "component-notes": false,
        "price": false,
        "unitPrice": false,
        "shelfNumber": false,
        "process": false,
        "paint": true,
        "dimensions": true,
        "cuttingTime": true,
        "nestCutTime": true,
        "nestName": true,
        "show-total-cost": false,
        "show-assemblyPicture": false,
    }
};
