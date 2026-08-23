"""Used by every benchmark script. Forces CP-SAT onto a single worker
thread in this process, so running benchmarks never spikes every core on
a personal dev machine.

Production (solver/engine.py) never imports this file, so it's never
affected. This only patches CpSolver in whichever process calls
force_single_worker().
"""

from ortools.sat.python import cp_model

_original_cp_solver_init = cp_model.CpSolver.__init__


def _single_worker_init(self, *args, **kwargs):
    _original_cp_solver_init(self, *args, **kwargs)
    self.parameters.num_search_workers = 1


def force_single_worker() -> None:
    """Safe to call more than once, even from different benchmark scripts."""
    cp_model.CpSolver.__init__ = _single_worker_init
