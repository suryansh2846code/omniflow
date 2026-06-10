/**
 * @typedef {Object} ClipMetadata
 * @property {number} clipIndex
 * @property {Object} timestamps
 * @property {number} timestamps.start
 * @property {number} timestamps.end
 * @property {string} originalDescription
 * @property {string} [cameraShotType]
 * @property {string} [speakerText]
 */

/**
 * @typedef {Object} VideoMetadata
 * @property {number} duration
 * @property {string} resolution
 * @property {number} fps
 * @property {string} overallDescription
 * @property {ClipMetadata[]} clips
 */

/**
 * @typedef {Object} PromptIntelligenceInput
 * @property {VideoMetadata} videoMetadata
 * @property {string} userPrompt
 */

/**
 * @typedef {Object} MasterContext
 * @property {string} visualGenre
 * @property {string} overallEnvironment
 * @property {string} editingStyle
 */

/**
 * @typedef {Object} CharacterSheet
 * @property {string} identity
 * @property {string} clothing
 * @property {string} face
 * @property {string} accessories
 * @property {string} bodyType
 */

/**
 * @typedef {Object} VisualDNA
 * @property {string} colorPalette
 * @property {string} lighting
 * @property {string} cameraLanguage
 * @property {string} editingStyle
 */

/**
 * @typedef {Object} ClipRelationship
 * @property {string} previousClipSummary
 * @property {string} currentClipGoal
 * @property {string} nextClipTransition
 */

/**
 * @typedef {Object} ThreeLayerPrompt
 * @property {string} master
 * @property {string} clip
 * @property {string} technical
 */

/**
 * @typedef {Object} ClipPromptOutput
 * @property {number} clipIndex
 * @property {Object} timestamps
 * @property {number} timestamps.start
 * @property {number} timestamps.end
 * @property {ClipRelationship} relationship
 * @property {ThreeLayerPrompt} threeLayerPrompt
 * @property {string} finalAssembledPrompt
 */

/**
 * @typedef {Object} ConsistencyRule
 * @property {string} ruleId
 * @property {string} propertyName
 * @property {string} description
 * @property {string} targetValue
 */

/**
 * @typedef {Object} PromptIntelligenceOutput
 * @property {MasterContext} masterContext
 * @property {CharacterSheet} characterSheet
 * @property {VisualDNA} visualDNA
 * @property {ClipPromptOutput[]} clipPrompts
 * @property {ConsistencyRule[]} consistencyRules
 */

export {};
