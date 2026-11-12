# Architecture rules
- Share MLB live data through one React Query hook between market cards and game charts to keep scores consistent and deduplicate polling.
- Publish official baseball markets, their options, and their audit entry through an admin-only atomic RPC to prevent incomplete or duplicate game markets.
- Keep official game start time separate from prediction closing time so live-game markets can remain open after first pitch.