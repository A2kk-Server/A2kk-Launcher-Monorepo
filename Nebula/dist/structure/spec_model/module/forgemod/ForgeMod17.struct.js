import { capitalize } from '../../../../util/StringUtils.js';
import { VersionUtil } from '../../../../util/VersionUtil.js';
import { BaseForgeModStructure } from '../ForgeMod.struct.js';
import { ForgeModType_1_7 } from '../../../../model/claritas/ClaritasResult.js';
export class ForgeModStructure17 extends BaseForgeModStructure {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static isForVersion(version, libraryVersion) {
        return VersionUtil.isVersionAcceptable(version, [7, 8, 9, 10, 11, 12]);
    }
    constructor(absoluteRoot, relativeRoot, baseUrl, minecraftVersion, untrackedFiles) {
        super(absoluteRoot, relativeRoot, baseUrl, minecraftVersion, untrackedFiles);
    }
    isForVersion(version, libraryVersion) {
        return ForgeModStructure17.isForVersion(version, libraryVersion);
    }
    getLoggerName() {
        return 'ForgeModStructure (1.7)';
    }
    async getModuleId(name, path) {
        const fmData = await this.getModMetadata(name, path);
        return this.generateMavenIdentifier(this.getClaritasGroup(path), fmData.modid, fmData.version);
    }
    async getModuleName(name, path) {
        return capitalize((await this.getModMetadata(name, path)).name);
    }
    isMalformedVersion(version) {
        // Ex. empty, @VERSION@, ${version}
        return version.trim().length === 0 || version.includes('@') || version.includes('$');
    }
    processZip(zip, name, path) {
        let raw;
        try {
            raw = zip.entryDataSync('mcmod.info');
        }
        catch (err) {
            // ignored
        }
        if (raw) {
            // Assuming the main mod will be the first entry in this file.
            try {
                const resolved = JSON.parse(raw.toString());
                if (Object.prototype.hasOwnProperty.call(resolved, 'modListVersion')) {
                    this.modMetadata[name] = resolved.modList[0];
                }
                else {
                    this.modMetadata[name] = resolved[0];
                }
            }
            catch (err) {
                this.logger.error(`ForgeMod ${name} contains an invalid mcmod.info file.`);
            }
        }
        else {
            this.logger.warn(`ForgeMod ${name} does not contain mcmod.info file.`);
        }
        const cRes = this.claritasResult[path];
        if (cRes == null) {
            this.logger.error(`Claritas failed to yield metadata for ForgeMod ${name}!`);
            this.logger.error('Is this mod malformated or does Claritas need an update?');
        }
        else {
            switch (cRes.modType) {
                case ForgeModType_1_7.CORE_MOD:
                    this.logger.info(`CORE_MOD Discovered: ForgeMod ${name} has no @Mod annotation. Metadata inference capabilities are limited.`);
                    break;
                case ForgeModType_1_7.TWEAKER:
                    this.logger.info(`TWEAKER Discovered: ForgeMod ${name} has no @Mod annotation. Metadata inference capabilities may be limited.`);
                    break;
                case ForgeModType_1_7.UNKNOWN:
                    this.logger.error(`Jar file ${name} is not a ForgeMod. Is it a library?`);
                    break;
            }
        }
        const claritasId = cRes?.id;
        const claritasVersion = cRes?.version;
        const claritasName = cRes?.name;
        // Validate
        const crudeInference = this.attemptCrudeInference(name);
        if (this.modMetadata[name] != null) {
            const x = this.modMetadata[name];
            if (x.modid == null || x.modid === '' || x.modid === this.EXAMPLE_MOD_ID) {
                x.modid = this.discernResult(claritasId, crudeInference.name.toLowerCase());
                x.name = this.discernResult(claritasName, crudeInference.name);
            }
            if (this.modMetadata[name].version != null) {
                const isMalformedVersion = this.isMalformedVersion(this.modMetadata[name].version);
                if (isMalformedVersion) {
                    x.version = this.discernResult(claritasVersion, crudeInference.version);
                }
            }
            else {
                x.version = this.discernResult(claritasVersion, crudeInference.version);
            }
        }
        else {
            this.modMetadata[name] = ({
                modid: this.discernResult(claritasId, crudeInference.name.toLowerCase()),
                name: this.discernResult(claritasName, crudeInference.name),
                version: this.discernResult(claritasVersion, crudeInference.version)
            });
        }
        return this.modMetadata[name];
    }
}
//# sourceMappingURL=ForgeMod17.struct.js.map