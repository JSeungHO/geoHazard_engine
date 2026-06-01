import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** @type {Record<string, string>} */
const CPG_TO_DECODER = {
  '949': 'euc-kr',
  cp949: 'euc-kr',
  'euc-kr': 'euc-kr',
  euckr: 'euc-kr',
  utf8: 'utf-8',
  'utf-8': 'utf-8',
  'windows-1252': 'windows-1252',
  '1252': 'windows-1252',
}

/**
 * Read `.cpg` beside a shapefile for dBASE text encoding.
 * @param {string} shpPath
 * @returns {Promise<string>}
 */
export async function readShapefileEncoding(shpPath) {
  const cpgPath = `${shpPath.slice(0, -path.extname(shpPath).length)}.cpg`
  try {
    const raw = (await readFile(cpgPath, 'utf8')).trim().toLowerCase()
    return CPG_TO_DECODER[raw] ?? raw
  } catch {
    return 'windows-1252'
  }
}
