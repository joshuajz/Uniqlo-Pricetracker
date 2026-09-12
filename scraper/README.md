The scheduled Canada workflow uploads prices daily and includes photos only on
the first day of each month (UTC). Manual workflow runs can request photos with
`include_images`. The Go API compresses uploaded photos before storage; local
scraper downloads remain at their original quality.
