import { resolve } from 'path'

import { Router } from 'express'
import { default as glob } from 'glob'

import file from './file'
import redirect from './redirect'

export type FilesystemHandleOptions = {
  indexFile: string
  notFoundFile: string
}

function filesystemOptions(
  value: string | Partial<FilesystemHandleOptions>
): FilesystemHandleOptions {
  const options = typeof value === 'string' ? { notFoundFile: value } : value

  return {
    indexFile: 'index.html',
    notFoundFile: '404.html',
    ...options,
  }
}

export default function filesystem(
  path: string,
  notFoundPage: string | Partial<FilesystemHandleOptions>
) {
  const router = Router()
  const options = filesystemOptions(notFoundPage)
  const indexFile = '/' + options.indexFile
  const cwd = resolve(process.cwd(), path)
  const files = Array.from(
    new Set(glob.sync('**/*', { cwd, nodir: true })).values()
  ).sort()

  for (const filePath of files) {
    const webPath = '/' + filePath // => /en/index.html

    if (webPath.endsWith(indexFile)) {
      const basePath = webPath.slice(0, -10)
      router.get(webPath, redirect(basePath)) // redirect /en/index.html => /en/
      router.get(basePath, file(resolve(cwd, filePath))) // load /en/index.html on /en/
    } else {
      router.get(webPath, file(resolve(cwd, filePath))) // load /en/other.html
    }
  }

  router.use(file(resolve(cwd, options.notFoundFile), 404))
  return router
}
