const api = typeof chrome !== 'undefined' ? chrome : browser;

document.addEventListener('DOMContentLoaded', () => {
    const ids = ['enable', 'lang-ko', 'lang-ja', 'lang-zh', 'show-translation'];

    
    api.storage.local.get(ids).then(result => {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = result[id] !== false;
            }
        });
    });

    
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                api.storage.local.set({ [id]: e.target.checked });
            });
        }
    });
});
