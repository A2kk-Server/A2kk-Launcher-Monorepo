import StreamZip from 'node-stream-zip'
import { capitalize } from '../../../../util/StringUtils.js'
import { VersionUtil } from '../../../../util/VersionUtil.js'
import { McModInfo } from '../../../../model/forge/McModInfo.js'
import { McModInfoList } from '../../../../model/forge/McModInfoList.js'
import { BaseForgeModStructure } from '../ForgeMod.struct.js'
import { MinecraftVersion } from '../../../../util/MinecraftVersion.js'
import { ForgeModType_1_7 } from '../../../../model/claritas/ClaritasResult.js'
import { UntrackedFilesOption } from '../../../../model/nebula/ServerMeta.js'

export class ForgeModStructure17 extends BaseForgeModStructure<McModInfo> {

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static isForVersion(version: MinecraftVersion, libraryVersion: string): boolean {
        return VersionUtil.isVersionAcceptable(version, [7, 8, 9, 10, 11, 12])
    }

    constructor(
        absoluteRoot: string,
        relativeRoot: string,
        baseUrl: string,
        minecraftVersion: MinecraftVersion,
        untrackedFiles: UntrackedFilesOption[]
    ) {
        super(absoluteRoot, relativeRoot, baseUrl, minecraftVersion, untrackedFiles)
    }

    public isForVersion(version: MinecraftVersion, libraryVersion: string): boolean {
        return ForgeModStructure17.isForVersion(version, libraryVersion)
    }

    public getLoggerName(): string {
        return 'ForgeModStructure (1.7)'
    }

    protected async getModuleId(name: string, path: string): Promise<string> {
        const fmData = await this.getModMetadata(name, path)
        return this.generateMavenIdentifier(this.getClaritasGroup(path), fmData.modid, fmData.version)
    }
    protected async getModuleName(name: string, path: string): Promise<string> {
        return capitalize((await this.getModMetadata(name, path)).name)
    }

    private isMalformedVersion(version: string): boolean {
        // Ex. empty, @VERSION@, ${version}
        return version.trim().length === 0 || version.includes('@') || version.includes('$')
    }

    protected processZip(zip: StreamZip, name: string, path: string): McModInfo {

        let raw: Buffer | undefined
        try {
            raw = zip.entryDataSync('mcmod.info')
        } catch(err) {
            // ignored
        }

        if (raw) {
            // Assuming the main mod will be the first entry in this file.
            try {
                const resolved = JSON.parse(raw.toString()) as (McModInfoList | McModInfo[])

                if (Object.prototype.hasOwnProperty.call(resolved, 'modListVersion')) {
                    this.modMetadata[name] = (resolved as McModInfoList).modList[0]
                } else {
                    this.modMetadata[name] = (resolved as McModInfo[])[0]
                }

            } catch (err) {
                this.logger.error(`ForgeMod ${name} contains an invalid mcmod.info file.`)
            }
        } else {
            this.logger.warn(`ForgeMod ${name} does not contain mcmod.info file.`)
        }

        const cRes = this.claritasResult[path]

        if(cRes == null) {
            this.logger.error(`Claritas failed to yield metadata for ForgeMod ${name}!`)
            this.logger.error('Is this mod malformated or does Claritas need an update?')
        } else {
            switch(cRes.modType!) {
                case ForgeModType_1_7.CORE_MOD:
                    this.logger.info(`CORE_MOD Discovered: ForgeMod ${name} has no @Mod annotation. Metadata inference capabilities are limited.`)
                    break
                case ForgeModType_1_7.TWEAKER:
                    this.logger.info(`TWEAKER Discovered: ForgeMod ${name} has no @Mod annotation. Metadata inference capabilities may be limited.`)
                    break
                case ForgeModType_1_7.UNKNOWN:
                    this.logger.error(`Jar file ${name} is not a ForgeMod. Is it a library?`)
                    break
            }
        }

        const claritasId = cRes?.id
        const claritasVersion = cRes?.version
        const claritasName = cRes?.name


        // Validate
        const crudeInference = this.attemptCrudeInference(name)
        if(this.modMetadata[name] != null) {
            
            const x = this.modMetadata[name]
            if(x.modid == null || x.modid === '' || x.modid === this.EXAMPLE_MOD_ID) {
                x.modid = this.discernResult(claritasId, crudeInference.name.toLowerCase())
                x.name = this.discernResult(claritasName, crudeInference.name)
            }

            if(this.modMetadata[name].version != null) {
                const isMalformedVersion = this.isMalformedVersion(this.modMetadata[name].version)
                if(isMalformedVersion) {
                    x.version = this.discernResult(claritasVersion, crudeInference.version)
                }
            } else {
                x.version = this.discernResult(claritasVersion, crudeInference.version)
            }
            
            
        } else {
            this.modMetadata[name] = ({
                modid: this.discernResult(claritasId, crudeInference.name.toLowerCase()),
                name: this.discernResult(claritasName, crudeInference.name),
                version: this.discernResult(claritasVersion, crudeInference.version)
            }) as McModInfo
        }

        return this.modMetadata[name]
    }

}
