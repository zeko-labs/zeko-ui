# Requirements

- [] Page loads without JS and displays a message to install a mina wallet if
  none is found
- [] Connect wallet UI for all supported wallet
  - [] Auro Wallet
  - [] Pallad
- [x] User wallet address is displayed when logged in
- [x] Disconnect wallet button is displayed
- [x] Supported Token balance is displayed
- [x] CTA to change transfer direction mina to zeko and from zeko to mina
- [x] UI element to choose which and how much token to transfer
- [x] CTA to BRIDGE
- [x] CTA to Withdraw
- [ ] UI element to confirm transfer
- [ ] UI element to show progress
- [ ] LocalStorage state tracking

# TODO

- [x] fetch both balances using graphQL
- [ ] handle errors
- [ ] local storage state restoration

# Questions to resolve

What happens if :

- User refresh the window
- User opens multiple tabs
- User open multiple windows
- User opens multiple browsers
- User switch account (with Auro)
- User remove wallet extension
- User switch network
- User open the same wallet anywhere else
- User loses network connection
- Users closes broser

Should the app :

- Allow multiple bridge operation at the same time?
