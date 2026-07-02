# Data sources

V1 uses Apple's public iTunes Search API for app lookup and keyword-result observations. Requests
are cached and globally throttled. Rankings beyond the first 200 results are stored as `null` and
displayed as `>200`.

ASOpulse does not claim to know search volume. Opportunity and competition are documented,
versioned calculations over observable result metadata.
