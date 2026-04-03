/**
 * 모든 언어 JSON 파일에 누락된 키를 en.json 기반으로 채우는 스크립트
 * 이미 번역된 키는 보존, 새 키만 en.json 값으로 추가
 */
const fs = require('fs');
const path = require('path');

const dictDir = path.join(__dirname, '..', 'app', 'dictionaries');
const enDict = JSON.parse(fs.readFileSync(path.join(dictDir, 'en.json'), 'utf-8'));
const koDict = JSON.parse(fs.readFileSync(path.join(dictDir, 'ko.json'), 'utf-8'));

// 21개 언어 중 ko, en 제외
const langs = fs.readdirSync(dictDir)
    .filter(f => f.endsWith('.json') && f !== 'ko.json' && f !== 'en.json')
    .map(f => f.replace('.json', ''));

function deepMerge(existing, template) {
    const result = { ...template };
    for (const key of Object.keys(template)) {
        if (existing && key in existing) {
            if (typeof template[key] === 'object' && !Array.isArray(template[key]) && template[key] !== null) {
                result[key] = deepMerge(existing[key], template[key]);
            } else {
                // 기존값 유지
                result[key] = existing[key];
            }
        }
        // 기존에 없으면 template(en) 값으로 유지
    }
    return result;
}

let updated = 0;
for (const lang of langs) {
    const filePath = path.join(dictDir, `${lang}.json`);
    let existing = {};
    if (fs.existsSync(filePath)) {
        existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    const merged = deepMerge(existing, enDict);
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 4) + '\n', 'utf-8');
    updated++;
    console.log(`✅ ${lang}.json merged (${Object.keys(merged).length} top-level keys)`);
}

console.log(`\nDone! Updated ${updated} language files.`);
