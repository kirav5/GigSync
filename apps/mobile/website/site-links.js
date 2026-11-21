// The website's pages have clean addresses where it is served (/, /story and /alpha). The dev server only knows the
// files (home.html, story.html, alpha.html), so there the links between the pages are pointed at the files instead.

const DEV_PAGE = /\.html$/;
const PAGE_LINKS = "a[data-page]";
const HREF = "href";
const HASH = "#";

/** Call once per page, before anything reads the links. */
export function linkPages() {
  if (!DEV_PAGE.test(location.pathname)) return;
  for (const link of document.querySelectorAll(PAGE_LINKS)) {
    const [, hash] = link.getAttribute(HREF).split(HASH);
    link.setAttribute(HREF, `./${link.dataset.page}.html${hash ? HASH + hash : ""}`);
  }
}
