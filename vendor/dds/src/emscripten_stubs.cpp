/*
  Stubs for DDS functions excluded from Emscripten build.
  Par.cpp excluded (Emscripten string issues, not needed with mode=-1).
  dump.cpp excluded (debug-only).
*/

#ifdef __EMSCRIPTEN__

#include "dll.h"
#include "dds.h"

// Par() stub — never called when CalcAllTablesPBN mode=-1
int STDCALL Par(
  ddTableResults *,
  parResults *,
  int)
{
  return -1; // RETURN_UNKNOWN_FAULT
}

// DumpInput() stub — debug logging, no-op
int DumpInput(
  const int errCode,
  const deal&,
  const int,
  const int,
  const int)
{
  return errCode;
}

#endif
