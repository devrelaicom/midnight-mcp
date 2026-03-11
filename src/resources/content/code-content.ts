/**
 * Embedded code examples and templates
 * Separated from code.ts for better maintainability
 */

export const EMBEDDED_CODE: Record<string, string> = {
  "midnight://code/examples/counter": `// Counter Example Contract
// A simple contract demonstrating basic Compact concepts

pragma language_version 0.21;

import CompactStandardLibrary;

// Public counter - visible to everyone
export ledger counter: Counter;

// Track last modifier (public)
export ledger lastModifier: Bytes<32>;

// Increment the counter
export circuit increment(amount: Uint<16>): Uint<64> {
  const delta = disclose(amount);
  // Validate input
  assert(delta > 0 as Uint<16>, "Amount must be positive");
  assert(delta <= 100 as Uint<16>, "Amount too large");
  
  // Update counter
  counter.increment(delta);
  
  // Return new value
  return counter.read();
}

// Decrement the counter
export circuit decrement(amount: Uint<16>): Uint<64> {
  const delta = disclose(amount);
  // Validate input
  assert(delta > 0 as Uint<16>, "Amount must be positive");
  assert(counter.read() >= (delta as Uint<64>), "Counter would go negative");
  
  // Update counter
  counter.decrement(delta);
  
  // Return new value
  return counter.read();
}

// Read current value (view function)
export circuit getValue(): Uint<64> {
  return counter.read();
}

// Check if counter is below threshold
export circuit isLessThan(threshold: Uint<64>): Boolean {
  return counter.lessThan(disclose(threshold));
}
`,

  "midnight://code/examples/bboard": `// Bulletin Board Example Contract
// Demonstrates commitment-backed messaging with selective disclosure

pragma language_version 0.21;

import CompactStandardLibrary;

// Public: message count and IDs
export ledger messageCount: Counter;
export ledger messageIds: Set<Field>;

// Commitment to each message body. The body itself stays off-chain until revealed.
ledger messageCommitments: Map<Field, Bytes<32>>;

// Author identifiers are kept on ledger for indexing.
ledger authors: Map<Field, Bytes<32>>;

// Witnesses for off-chain message storage
witness storeMessageContent(id: Field, content: Opaque<"string">): [];
witness getMessageContent(id: Field): Opaque<"string">;
witness getMessageSalt(id: Field): Bytes<32>;

// Post a new message (content stays off-chain until revealed)
export circuit postMessage(content: Opaque<"string">, author: Bytes<32>): Uint<64> {
  // Generate unique message ID using counter read
  const messageId = messageCount.read();
  const storedAuthor = disclose(author);
  const salt = getMessageSalt(messageId as Field);
  const commitment = persistentCommit<Opaque<"string">>(content, salt);
  
  // Store message off-chain and persist only its commitment on-chain
  storeMessageContent(messageId as Field, content);
  messageCommitments.insert(messageId as Field, commitment);
  authors.insert(messageId as Field, storedAuthor);
  
  // Update public counters
  messageCount.increment(1);
  messageIds.insert(messageId as Field);
  
  return messageId;
}

// Reveal a message publicly (owner's choice)
export circuit revealMessage(id: Field): Opaque<"string"> {
  const messageId = disclose(id);
  assert(messageIds.member(messageId), "Message not found");
  
  const content = getMessageContent(messageId);
  const salt = getMessageSalt(messageId);
  const expectedCommitment = persistentCommit<Opaque<"string">>(content, salt);
  assert(
    disclose(messageCommitments.lookup(messageId) == expectedCommitment),
    "Stored message commitment mismatch"
  );
  return disclose(content);
}

// Get total message count
export circuit getMessageCount(): Uint<64> {
  return messageCount.read();
}
`,

  "midnight://code/patterns/state-management": `// State Management Pattern
// Best practices for managing public state, internal ledger fields, and witness-backed private data

pragma language_version 0.21;

import CompactStandardLibrary;

// PUBLIC STATE
// - Use 'export ledger' for data that should be transparent
// - Visible in blockchain explorers
// - Can be queried by anyone

export ledger totalSupply: Uint<64>;
export ledger publicConfig: Field;

// INTERNAL LEDGER STATE
// - 'ledger' without export keeps fields out of the generated public API
// - Ledger writes are still observable on-chain
// - Use witnesses or commitments for truly private data

ledger userSecrets: Map<Bytes<32>, Bytes<32>>;
ledger balanceCommitments: Map<Bytes<32>, Field>;

// Witnesses for witness-backed private data access
witness getUserSecret(user: Bytes<32>): Bytes<32>;
witness getPrivateBalance(user: Bytes<32>): Field;

// Reading public state is straightforward
export circuit getTotalSupply(): Uint<64> {
  return totalSupply;
}

// Using witness-backed private data in a circuit
export circuit proveSecretKnowledge(
  user: Bytes<32>,
  secretHash: Bytes<32>
): Boolean {
  const secret = getUserSecret(user);
  const expectedHash = disclose(secretHash);
  
  // Prove knowledge without revealing secret
  assert(disclose(persistentHash<Bytes<32>>(secret) == expectedHash), "Invalid secret");
  return true;
}

// Selective disclosure pattern
export circuit revealBalance(user: Bytes<32>): Field {
  const balance = getPrivateBalance(user);
  // Explicitly reveal - user's choice
  return disclose(balance);
}
`,

  "midnight://code/patterns/access-control": `// Access Control Pattern
// Implementing permissions and authorization

pragma language_version 0.21;

import CompactStandardLibrary;

// Role definitions
export ledger owner: Bytes<32>;
export ledger admins: Set<Bytes<32>>;

// Access-controlled state
export ledger sensitiveData: Field;

// Internal ledger copy of admin key material
ledger adminKeys: Map<Bytes<32>, Bytes<32>>;

// Witness to get caller identity
witness getCaller(): Bytes<32>;

// Only owner can call
export circuit onlyOwnerAction(newValue: Field): [] {
  const caller = disclose(getCaller());
  const updatedValue = disclose(newValue);
  assert(caller == owner, "Not owner");
  sensitiveData = updatedValue;
}

// Only admins can call
export circuit onlyAdminAction(data: Field): [] {
  const caller = disclose(getCaller());
  const payload = disclose(data);
  assert(admins.member(caller), "Not admin");
  
  sensitiveData = payload;
}

// Multi-sig pattern (require multiple approvals)
witness getApprovalCount(action: Bytes<32>): Uint<64>;

export circuit requireMultisig(action: Bytes<32>, threshold: Uint<64>): Boolean {
  const approvals = getApprovalCount(action);
  assert(disclose(approvals >= disclose(threshold)), "Insufficient approvals");
  return true;
}

// Time-locked action
witness getCurrentTime(): Uint<64>;

export circuit timeLockedAction(unlockTime: Uint<64>): [] {
  const currentTime = getCurrentTime();
  assert(disclose(currentTime >= disclose(unlockTime)), "Action is timelocked");
  
  // Perform action
}
`,

  "midnight://code/patterns/privacy-preserving": `// Privacy-Preserving Patterns
// Techniques for maintaining privacy in smart contracts

pragma language_version 0.21;

import CompactStandardLibrary;

struct CommitmentInput {
  amount: Uint<64>,
  nonce: Field,
}

// Commitment-backed shielded balance
export ledger balanceCommitments: Map<Bytes<32>, Bytes<32>>;

// Nullifier set (prevents double-spending)
export ledger nullifiers: Set<Bytes<32>>;

// Internal ledger state used to verify witness-backed balance data
ledger secretBalances: Map<Bytes<32>, Uint<64>>;
ledger secretNonces: Map<Bytes<32>, Field>;

// Witnesses for witness-backed private data
witness getSecretBalance(user: Bytes<32>): Uint<64>;
witness getSecretNonce(user: Bytes<32>): Field;

// PATTERN 1: Commitment Scheme
// Store commitments instead of values

export circuit deposit(
  user: Bytes<32>,
  amount: Uint<64>,
  nonce: Field
): Bytes<32> {
  // Create commitment: hash(amount || nonce)
  const account = disclose(user);
  const input = CommitmentInput { amount: amount, nonce: nonce };
  const commitment = disclose(persistentHash<CommitmentInput>(input));
  
  // Store commitment (hides amount)
  balanceCommitments.insert(account, commitment);
  
  return commitment;
}

export circuit proveBalance(
  user: Bytes<32>,
  amount: Uint<64>,
  nonce: Field,
  minBalance: Uint<64>
): Boolean {
  // Verify commitment
  const account = disclose(user);
  const input = CommitmentInput { amount: amount, nonce: nonce };
  const expectedCommitment = persistentHash<CommitmentInput>(input);
  assert(
    disclose(balanceCommitments.lookup(account) == expectedCommitment),
    "Invalid commitment"
  );
  
  // Prove property without revealing value
  assert(disclose(amount >= disclose(minBalance)), "Insufficient balance");
  return true;
}

// PATTERN 2: Nullifiers (Prevent Double-Spending)

witness generateNullifier(secret: Bytes<32>, action: Field): Bytes<32>;

export circuit spendOnce(
  secret: Bytes<32>,
  action: Field
): [] {
  const nullifier = disclose(generateNullifier(secret, action));
  
  // Check nullifier hasn't been used
  assert(!nullifiers.member(nullifier), "Already spent");
  
  // Mark as used
  nullifiers.insert(nullifier);
  
  // Perform action
}

// PATTERN 3: Range Proofs

export circuit proveInRange(
  value: Uint<64>,
  min: Uint<64>,
  max: Uint<64>
): Boolean {
  // Prove value is in range without revealing it
  assert(disclose(value >= min), "Below minimum");
  assert(disclose(value <= max), "Above maximum");
  return true;
}

// PATTERN 4: Private Set Membership

witness computeMerkleRoot(element: Field, proof: Vector<10, Field>): Field;

export circuit proveMembership(
  element: Field,
  setRoot: Field,
  proof: Vector<10, Field>
): Boolean {
  // Prove element is in set without revealing which element
  const computedRoot = computeMerkleRoot(element, proof);
  assert(disclose(computedRoot == setRoot), "Invalid membership proof");
  return true;
}
`,

  "midnight://code/templates/token": `// Commitment-Backed Token Template
// Starter template for commitment-backed balances with witness-managed state

pragma language_version 0.21;

import CompactStandardLibrary;

// Public token metadata
export ledger name: Bytes<32>;
export ledger symbol: Bytes<8>;
export ledger decimals: Uint<8>;
export ledger totalSupply: Uint<64>;

// Public token metadata
// Balance values stay hidden behind commitments.
ledger balanceCommitments: Map<Bytes<32>, Bytes<32>>;

// Witnesses for witness-backed balance state
witness getBalance(account: Bytes<32>): Uint<64>;
witness getBalanceSalt(account: Bytes<32>): Bytes<32>;
witness getFreshBalanceSalt(account: Bytes<32>): Bytes<32>;
witness storeBalance(account: Bytes<32>, balance: Uint<64>): [];
witness getCaller(): Bytes<32>;

// Transfer tokens using commitment-backed balances
export circuit transfer(
  to: Bytes<32>,
  amount: Uint<64>
): Boolean {
  const sender = disclose(getCaller());
  const recipient = disclose(to);
  const transferAmount = disclose(amount);
  const senderBalance = getBalance(sender);
  const recipientBalance = getBalance(recipient);
  const senderSalt = getBalanceSalt(sender);
  const recipientSalt = getBalanceSalt(recipient);
  
  // Validate
  assert(transferAmount > 0, "Invalid amount");
  assert(
    disclose(balanceCommitments.lookup(sender) == persistentCommit<Uint<64>>(senderBalance, senderSalt)),
    "Sender balance commitment mismatch"
  );
  assert(
    disclose(
      balanceCommitments.lookup(recipient) ==
      persistentCommit<Uint<64>>(recipientBalance, recipientSalt)
    ),
    "Recipient balance commitment mismatch"
  );
  assert(disclose(senderBalance >= transferAmount), "Insufficient balance");
  
  // Update hidden balances via fresh commitments
  const newSenderBalance = (senderBalance - transferAmount) as Uint<64>;
  const newRecipientBalance = (recipientBalance + transferAmount) as Uint<64>;
  storeBalance(sender, newSenderBalance);
  storeBalance(recipient, newRecipientBalance);
  balanceCommitments.insert(
    sender,
    persistentCommit<Uint<64>>(newSenderBalance, getFreshBalanceSalt(sender))
  );
  balanceCommitments.insert(
    recipient,
    persistentCommit<Uint<64>>(newRecipientBalance, getFreshBalanceSalt(recipient))
  );
  
  return true;
}

// Reveal balance (user's choice)
export circuit revealMyBalance(): Uint<64> {
  const caller = disclose(getCaller());
  const balance = getBalance(caller);
  const salt = getBalanceSalt(caller);
  assert(
    disclose(balanceCommitments.lookup(caller) == persistentCommit<Uint<64>>(balance, salt)),
    "Balance commitment mismatch"
  );
  return disclose(balance);
}

// Mint new tokens (admin only)
export circuit mint(to: Bytes<32>, amount: Uint<64>): Boolean {
  const recipient = disclose(to);
  const mintedAmount = disclose(amount);
  const currentBalance = getBalance(recipient);
  const currentSalt = getBalanceSalt(recipient);
  // Add access control in production
  assert(
    disclose(balanceCommitments.lookup(recipient) == persistentCommit<Uint<64>>(currentBalance, currentSalt)),
    "Recipient balance commitment mismatch"
  );
  const updatedBalance = (currentBalance + mintedAmount) as Uint<64>;
  storeBalance(recipient, updatedBalance);
  balanceCommitments.insert(
    recipient,
    persistentCommit<Uint<64>>(updatedBalance, getFreshBalanceSalt(recipient))
  );
  totalSupply = disclose((totalSupply + mintedAmount) as Uint<64>);
  return true;
}
`,

  "midnight://code/templates/voting": `// Commitment-Backed Voting Template
// Starter template for hidden vote values with public proposal metadata

pragma language_version 0.21;

import CompactStandardLibrary;

// Public: proposal metadata
export ledger proposalCount: Counter;
export ledger proposals: Map<Uint<64>, Bytes<256>>;
export ledger votingDeadlines: Map<Uint<64>, Uint<64>>;

// Hidden vote commitments. Voter identity checks are still public in this scaffold.
ledger voteCommitments: Set<Bytes<32>>;

// Nullifiers to prevent double voting
export ledger voteNullifiers: Set<Bytes<32>>;

// Eligible voters
export ledger eligibleVoters: Set<Bytes<32>>;

// Witnesses
witness getCaller(): Bytes<32>;
witness getCurrentTime(): Uint<64>;
witness getVote(proposalId: Uint<64>, voter: Bytes<32>): Uint<8>;
witness computeNullifier(voter: Bytes<32>, proposalId: Uint<64>): Bytes<32>;
witness computeVoteCommitment(voter: Bytes<32>, proposalId: Uint<64>, option: Uint<8>): Bytes<32>;

// Create a new proposal
export circuit createProposal(
  description: Bytes<256>,
  deadline: Uint<64>
): Uint<64> {
  const proposalId = proposalCount.read();
  const proposalText = disclose(description);
  const closingTime = disclose(deadline);
  
  // Store proposal - proposalId is Uint<64> from Counter.read()
  proposals.insert(proposalId, proposalText);
  votingDeadlines.insert(proposalId, closingTime);
  
  proposalCount.increment(1);
  return proposalId;
}

// Cast a commitment-backed vote
export circuit vote(
  proposalId: Uint<64>,
  option: Uint<8>
): Boolean {
  const voter = disclose(getCaller());
  const currentTime = getCurrentTime();
  const proposal = disclose(proposalId);
  const selectedOption = disclose(option);
  
  // Check eligibility
  assert(eligibleVoters.member(voter), "Not eligible to vote");
  
  // Check deadline
  const deadline = votingDeadlines.lookup(proposal);
  assert(disclose(currentTime < deadline), "Voting ended");
  
  // Check for double voting using nullifier
  const nullifier = disclose(computeNullifier(voter, proposal));
  assert(!voteNullifiers.member(nullifier), "Already voted");
  const voteCommitment = disclose(computeVoteCommitment(voter, proposal, selectedOption));
  voteCommitments.insert(voteCommitment);

  // Add nullifier to prevent double voting
  voteNullifiers.insert(nullifier);
  
  return true;
}

// Reveal individual vote (voter's choice)
export circuit revealMyVote(proposalId: Uint<64>): Uint<8> {
  const voter = disclose(getCaller());
  const myVote = getVote(proposalId, voter);
  const voteCommitment = disclose(computeVoteCommitment(voter, disclose(proposalId), myVote));
  assert(voteCommitments.member(voteCommitment), "No committed vote found");
  return disclose(myVote);
}

// Add eligible voter (admin only)
export circuit addVoter(voter: Bytes<32>): [] {
  // Add access control in real implementation
  eligibleVoters.insert(disclose(voter));
}
`,

  "midnight://code/examples/nullifier": `// Nullifier Pattern Example
// Demonstrates how to create and use nullifiers to prevent double-spending/actions

pragma language_version 0.21;

import CompactStandardLibrary;

// Set of used nullifiers - prevents replay attacks
export ledger usedNullifiers: Set<Bytes<32>>;

// Track claimed rewards
export ledger claimedRewards: Counter;

// Hash function for creating nullifiers
// Combines secret + public data to create unique identifier
witness computeNullifier(secret: Field, commitment: Field): Bytes<32>;

// Alternative: nullifier from address and action ID
witness computeActionNullifier(userSecret: Field, actionId: Field): Bytes<32>;

// Claim a reward (can only claim once per user)
// Note: rewardAmount is Uint<16> to match Counter.increment signature
export circuit claimReward(
  secret: Field,
  commitment: Field,
  rewardAmount: Uint<16>
): Boolean {
  // Compute the nullifier
  const nullifier = disclose(computeNullifier(secret, commitment));
  const reward = disclose(rewardAmount);
  
  // Check nullifier hasn't been used (prevents double-claim)
  assert(
    !usedNullifiers.member(nullifier), 
    "Reward already claimed"
  );
  
  // Mark nullifier as used
  usedNullifiers.insert(nullifier);
  
  // Process reward (Counter.increment takes Uint<16>)
  claimedRewards.increment(reward);
  
  return true;
}

// Vote with nullifier (prevents double-voting)
export circuit voteWithNullifier(
  voterSecret: Field,
  proposalId: Field,
  vote: Field
): Boolean {
  // Create unique nullifier for this voter + proposal
  const nullifier = disclose(computeActionNullifier(voterSecret, proposalId));
  
  // Ensure hasn't voted on this proposal
  assert(
    !usedNullifiers.member(nullifier),
    "Already voted on this proposal"
  );
  
  // Record nullifier
  usedNullifiers.insert(nullifier);
  
  // Process vote...
  return true;
}
`,

  "midnight://code/examples/hash": `// Hash Functions in Compact
// Examples of using hash functions for various purposes

pragma language_version 0.21;

import CompactStandardLibrary;

export ledger commitments: Set<Bytes<32>>;
export ledger hashedData: Map<Field, Bytes<32>>;

circuit hashValue(data: Field): Bytes<32> {
  return persistentHash<Field>(data);
}

circuit commitmentOf(value: Field, randomness: Field): Bytes<32> {
  return persistentHash<Vector<2, Field>>([value, randomness]);
}

// Verify a commitment matches
export circuit verifyCommitment(
  value: Field,
  randomness: Field,
  expectedCommitment: Bytes<32>
): Boolean {
  const computed = commitmentOf(value, randomness);
  assert(disclose(computed == expectedCommitment), "Commitment mismatch");
  return true;
}

// Store a hashed value
export circuit storeHashed(id: Field, data: Field): Bytes<32> {
  const key = disclose(id);
  const hashed = disclose(hashValue(data));
  hashedData.insert(key, hashed);
  return hashed;
}

// Commit-reveal pattern
export circuit commit(commitment: Bytes<32>): Boolean {
  const committed = disclose(commitment);
  assert(!commitments.member(committed), "Already committed");
  commitments.insert(committed);
  return true;
}

export circuit reveal(value: Field, randomness: Field): Field {
  const commitment = disclose(commitmentOf(value, randomness));
  assert(commitments.member(commitment), "No matching commitment");
  return disclose(value);
}
`,

  "midnight://code/examples/simple-counter": `// Simple Counter Contract
// Minimal example for learning Compact basics

pragma language_version 0.21;

import CompactStandardLibrary;

// Ledger state - stored on chain
export ledger counter: Counter;

// Increment the counter by 1
export circuit increment(): Uint<64> {
  counter.increment(1);
  return counter.read();
}

// Decrement the counter by 1  
export circuit decrement(): Uint<64> {
  assert(counter.read() > 0 as Uint<64>, "Cannot go below zero");
  counter.decrement(1);
  return counter.read();
}

// Get current value
export circuit get(): Uint<64> {
  return counter.read();
}

// Check if below threshold
export circuit isBelowLimit(limit: Uint<64>): Boolean {
  return counter.lessThan(disclose(limit));
}

// Reset to zero
export circuit reset(): [] {
  counter.resetToDefault();
}
`,

  "midnight://code/templates/basic": `// Basic Compact Contract Template
// Starting point for new contracts

pragma language_version 0.21;

import CompactStandardLibrary;

// ============================================
// LEDGER STATE
// ============================================

// Public state (visible on-chain)
export ledger initialized: Boolean;
export ledger owner: Bytes<32>;

// Internal state. For real privacy, store a commitment rather than the raw value.
ledger secretCommitment: Bytes<32>;

// ============================================
// WITNESSES
// ============================================

witness getCaller(): Bytes<32>;
witness getSecret(): Field;
witness getSecretSalt(): Bytes<32>;

// ============================================
// INITIALIZATION
// ============================================

export circuit initialize(ownerAddress: Bytes<32>): Boolean {
  assert(!initialized, "Already initialized");
  
  owner = disclose(ownerAddress);
  initialized = true;
  
  return true;
}

// ============================================
// PUBLIC FUNCTIONS
// ============================================

export circuit publicFunction(input: Field): Field {
  assert(initialized, "Not initialized");
  
  // Your logic here
  return disclose(input * 2);
}

// ============================================
// OWNER-ONLY FUNCTIONS
// ============================================

export circuit setSecret(newSecret: Field): [] {
  const caller = disclose(getCaller());
  assert(caller == owner, "Only owner can set secret");
  secretCommitment = persistentCommit<Field>(newSecret, getSecretSalt());
}

// ============================================
// PRIVATE DATA ACCESS
// ============================================

export circuit revealSecret(): Field {
  const caller = disclose(getCaller());
  const secret = getSecret();
  const salt = getSecretSalt();
  assert(caller == owner, "Only owner can reveal");
  assert(
    disclose(secretCommitment == persistentCommit<Field>(secret, salt)),
    "Secret commitment mismatch"
  );
  return disclose(secret);
}
`,
};
