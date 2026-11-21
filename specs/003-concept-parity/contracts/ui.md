# UI contract

| Surface      | Interaction                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview     | Previous/next selects a Berlin month; recent preview has at most five rows. Current month and secondary actions remain reachable.                       |
| Header       | Profile opens account management; account group selector opens a dialog; theme toggle remains keyboard-operable and skips animation for reduced motion. |
| Transactions | Month controls drive a date range. Search/account/category are primary; advanced controls preserve deep links, paging and editing.                      |
| Analytics    | Tiled landing shows month/cashflow/wealth/analysis hierarchy. Detail opens in place and preserves scope.                                                |
| Contracts    | Three summary tiles and in-place calendar. Forecasts remain clearly designated.                                                                         |
| Navigation   | Wealth is a primary tab. More groups money destinations and management.                                                                                 |

Dialogs keep keyboard focus inside, close via Escape, and restore focus. Hover highlights have a keyboard equivalent and do not shift layout.
