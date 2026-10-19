import { SystemRegistry, defineSystem } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
    id: 'dh',
    title: 'Daggerheart',
    version: '1.0.0',

    // Tipos de actor e item que este sistema define
    actorTypes: ['character', 'npc', 'monster'],
    itemTypes: ['weapon', 'armor', 'spell', 'feature'],

    // Dados padrão para cada tipo
    getDefaultData(type) {
        if (type === 'character') {
            return {
                hp: { value: 10, max: 10 },
                attributes: { str: 10, agi: 10, finn: 10, inst: 10, pres: 10, know: 10 },
            };
        }
        return {};
    },

    // Validação de dados
    validateData(type, data) {
        const errors = [];
        if (data.hp?.value > data.hp?.max) errors.push('HP não pode exceder máximo');
        return { valid: errors.length === 0, errors };
    },

    rollInitiative(actor) {
        return { formula: '1d12', total: Math.floor(Math.random() * 12) + 1 };
    },

    // Schema de ficha de actor
    getSheetSchema(actorType) {
        return {
            tabs: [{
                id: 'main',
                label: 'Principal',
                fields: [
                    { key: 'hp.value', label: 'HP', type: 'number' },
                    { key: 'hp.max', label: 'HP Máx', type: 'number' },
                ],
            }],
        };
    },

    getItemSheetSchema(itemType) {
        return { tabs: [{ id: 'main', label: 'Geral', fields: [] }] };
    },
}));