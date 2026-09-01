import { FaFileAlt } from "react-icons/fa";

/**
 * Friendly, locale-aware empty state shown when a CMS page has been created
 * but no content has been published yet — or when no CMS row exists at all.
 *
 * Used on the public site to give visitors a clear "this page is not ready"
 * message instead of a blank page or sample placeholder text.
 *
 * This is a server component that accepts pre-translated strings from the
 * calling page. The caller is responsible for detecting the locale and
 * passing the appropriate translation keys.
 */
export function ContentNotFound({
  tNotFound,
  tNotFoundDescription,
}: {
  tNotFound: string;
  tNotFoundDescription: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-navy-50 to-ink-100 text-navy-700 shadow-soft">
        <FaFileAlt className="h-12 w-12" aria-hidden="true" />
      </div>
      <h2 className="mt-6 font-display text-2xl font-extrabold text-navy-900 sm:text-4xl">
        {tNotFound}
      </h2>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-500">{tNotFoundDescription}</p>
    </div>
  );
}
