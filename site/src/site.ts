// Values the pages need. Imported in page frontmatter, so it runs at build time.

import { API_URL, loginUrl } from '#/lib/api'

// Without it every "Sign in" link would be broken.
if (!API_URL) {
  throw new Error(
    'VITE_API_URL is not set. Put it in .env, or pass --build-arg VITE_API_URL=… to docker build.',
  )
}

export { API_URL, loginUrl }

export const SITE_NAME = 'TeachForFree'

/** Also written out in content/legal/*.md. */
export const CONTACT_EMAIL = 'a.barragan.89@gmail.com'
