
// blockhash-core simplified
const sharp = require('sharp');

async function bmvbhash(buffer, bits) {
    const { data, info } = await sharp(buffer).resize(bits, bits).grayscale().raw().toBuffer({ resolveWithObject: true });
    let hash = '';
    for (let i = 0; i < data.length; i++) {
        hash += data[i] > 128 ? '1' : '0';
    }
    return hash;
}

module.exports = { bmvbhash };
