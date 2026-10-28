**Fail fast on missing payment credentials.** The api refuses to start without valid VNPay
credentials, so a misconfiguration shows up at deploy time rather than at the first payment. The
check lives in the server entry point, so the seed, migrations and tests run without them.
