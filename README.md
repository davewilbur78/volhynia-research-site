# Volhynia research site

Static source for research.papermensch.com.

- `index.html` is the Volhynia Guberniya Jewish records finding aid (the "classic" build).
- `.cpanel.yml` tells cPanel Git Version Control what to copy into the docroot on deploy.

Deploy flow: push to main, then pull + deploy in cPanel Git Version Control (or via UAPI VersionControl).
