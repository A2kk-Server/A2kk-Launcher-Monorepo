import { Type } from 'helios-distribution-types';
import { BaseModStructure } from './Mod.struct.js';
import { LibraryType } from '../../../model/claritas/ClaritasLibraryType.js';
export class BaseForgeModStructure extends BaseModStructure {
    EXAMPLE_MOD_ID = 'examplemod';
    constructor(absoluteRoot, relativeRoot, baseUrl, minecraftVersion, untrackedFiles) {
        super(absoluteRoot, relativeRoot, 'forgemods', baseUrl, minecraftVersion, Type.ForgeMod, untrackedFiles);
    }
    getClaritasExceptions() {
        return [];
    }
    getClaritasType() {
        return LibraryType.FORGE;
    }
    discernResult(claritasValue, crudeInference) {
        return (claritasValue == null || claritasValue == '') ? crudeInference : claritasValue;
    }
}
//# sourceMappingURL=ForgeMod.struct.js.map