/**
 * Support Questionnaire Flow Definitions
 * 
 * Decision trees for each support ticket type that gather required information
 * before creating a ticket or connecting to a live agent.
 * 
 * Flow structure:
 * - Each flow has multiple steps with questions
 * - Questions can be conditional based on previous answers
 * - Answers are collected and used to populate ticket fields
 */

export type QuestionType = 'select' | 'multiselect' | 'text' | 'textarea' | 'order-select' | 'yesno' | 'email' | 'phone';

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  icon?: string; // Phosphor icon name
  nextStep?: string; // Override default next step
}

export interface Question {
  id: string;
  text: string;
  subtext?: string;
  type: QuestionType;
  options?: QuestionOption[];
  placeholder?: string;
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    message?: string;
  };
  showIf?: {
    questionId: string;
    value: string | string[];
  };
  mapToField?: string; // Maps to SupportTicket field
}

export interface QuestionnaireStep {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  nextStep?: string;
}

export interface QuestionnaireFlow {
  id: string;
  ticketType: string;
  name: string;
  description: string;
  icon: string;
  steps: QuestionnaireStep[];
  generateSummary: (answers: Record<string, string>) => string;
  getPriority: (answers: Record<string, string>) => 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

// ===== ISSUE CATEGORY SELECTION =====
export const ISSUE_CATEGORIES: QuestionOption[] = [
  {
    value: 'order',
    label: 'Order Issues',
    description: 'Problems with your order, wrong items, cancellations',
    icon: 'Package',
  },
  {
    value: 'shipping',
    label: 'Shipping & Delivery',
    description: 'Tracking, delays, lost packages, address changes',
    icon: 'Truck',
  },
  {
    value: 'return',
    label: 'Returns & Refunds',
    description: 'Return requests, refund status, exchanges',
    icon: 'ArrowUUpLeft',
  },
  {
    value: 'payment',
    label: 'Payment Issues',
    description: 'Billing problems, failed payments, double charges',
    icon: 'CreditCard',
  },
  {
    value: 'product',
    label: 'Product Questions',
    description: 'Sizing, materials, availability, recommendations',
    icon: 'TShirt',
  },
  {
    value: 'loyalty',
    label: 'Care Points & Rewards',
    description: 'Points balance, tier status, rewards redemption',
    icon: 'Heart',
  },
  {
    value: 'account',
    label: 'Account Help',
    description: 'Login issues, profile updates, password reset',
    icon: 'User',
  },
  {
    value: 'other',
    label: 'Something Else',
    description: 'General questions or other issues',
    icon: 'ChatCircle',
  },
];

// ===== ORDER ISSUES FLOW =====
export const orderIssuesFlow: QuestionnaireFlow = {
  id: 'order-issues',
  ticketType: 'ORDER_ISSUE',
  name: 'Order Issues',
  description: 'Help with order problems',
  icon: 'Package',
  steps: [
    {
      id: 'order-select',
      title: 'Select Your Order',
      description: 'Which order do you need help with?',
      questions: [
        {
          id: 'orderId',
          text: 'Select your order',
          subtext: 'Choose from your recent orders or enter an order number',
          type: 'order-select',
          required: true,
          mapToField: 'orderId',
        },
      ],
      nextStep: 'issue-type',
    },
    {
      id: 'issue-type',
      title: 'What happened?',
      description: 'Tell us about the issue',
      questions: [
        {
          id: 'orderIssueType',
          text: 'What best describes your issue?',
          type: 'select',
          required: true,
          options: [
            { value: 'wrong-item', label: 'I received the wrong item', icon: 'WarningCircle' },
            { value: 'missing-item', label: 'Items are missing from my order', icon: 'Package' },
            { value: 'damaged', label: 'Item arrived damaged', icon: 'Warning' },
            { value: 'not-as-described', label: 'Item doesn\'t match the description', icon: 'Question' },
            { value: 'cancel', label: 'I need to cancel my order', icon: 'X' },
            { value: 'modify', label: 'I need to modify my order', icon: 'PencilSimple' },
            { value: 'other', label: 'Other issue', icon: 'DotsThree' },
          ],
        },
      ],
      nextStep: 'details',
    },
    {
      id: 'details',
      title: 'Additional Details',
      description: 'Help us understand the issue better',
      questions: [
        {
          id: 'affectedItems',
          text: 'Which item(s) are affected?',
          type: 'text',
          placeholder: 'e.g., Black Oversized Hoodie - Size L',
          required: true,
          showIf: { questionId: 'orderIssueType', value: ['wrong-item', 'missing-item', 'damaged', 'not-as-described'] },
        },
        {
          id: 'cancelReason',
          text: 'Why do you need to cancel?',
          type: 'select',
          required: true,
          showIf: { questionId: 'orderIssueType', value: 'cancel' },
          options: [
            { value: 'changed-mind', label: 'Changed my mind' },
            { value: 'ordered-wrong', label: 'Ordered wrong item/size' },
            { value: 'found-better', label: 'Found it cheaper elsewhere' },
            { value: 'taking-too-long', label: 'Taking too long to ship' },
            { value: 'other', label: 'Other reason' },
          ],
        },
        {
          id: 'modifyRequest',
          text: 'What would you like to modify?',
          type: 'select',
          required: true,
          showIf: { questionId: 'orderIssueType', value: 'modify' },
          options: [
            { value: 'address', label: 'Shipping address' },
            { value: 'size', label: 'Size/Color' },
            { value: 'add-items', label: 'Add more items' },
            { value: 'remove-items', label: 'Remove items' },
            { value: 'other', label: 'Other modification' },
          ],
        },
        {
          id: 'description',
          text: 'Please describe the issue in detail',
          type: 'textarea',
          placeholder: 'Tell us more about what happened...',
          required: true,
          validation: { minLength: 20, message: 'Please provide at least 20 characters' },
          mapToField: 'refundReason',
        },
      ],
    },
  ],
  generateSummary: (answers) => {
    const issueTypes: Record<string, string> = {
      'wrong-item': 'Wrong item received',
      'missing-item': 'Missing items',
      'damaged': 'Damaged item',
      'not-as-described': 'Item not as described',
      'cancel': 'Order cancellation request',
      'modify': 'Order modification request',
      'other': 'Other order issue',
    };
    return `${issueTypes[answers.orderIssueType] || 'Order issue'} - ${answers.affectedItems || answers.description?.substring(0, 50) || 'See details'}`;
  },
  getPriority: (answers) => {
    if (answers.orderIssueType === 'damaged' || answers.orderIssueType === 'wrong-item') return 'HIGH';
    if (answers.orderIssueType === 'cancel') return 'MEDIUM';
    return 'MEDIUM';
  },
};

// ===== SHIPPING FLOW =====
export const shippingFlow: QuestionnaireFlow = {
  id: 'shipping',
  ticketType: 'SHIPPING_ISSUE',
  name: 'Shipping & Delivery',
  description: 'Shipping and delivery help',
  icon: 'Truck',
  steps: [
    {
      id: 'order-select',
      title: 'Select Your Order',
      questions: [
        {
          id: 'orderId',
          text: 'Which order is this about?',
          type: 'order-select',
          required: true,
          mapToField: 'orderId',
        },
      ],
      nextStep: 'issue-type',
    },
    {
      id: 'issue-type',
      title: 'Shipping Issue',
      questions: [
        {
          id: 'shippingIssue',
          text: 'What\'s happening with your shipment?',
          type: 'select',
          required: true,
          options: [
            { value: 'tracking', label: 'Tracking not updating', icon: 'MapPin' },
            { value: 'delayed', label: 'Package is delayed', icon: 'Clock' },
            { value: 'lost', label: 'Package appears lost', icon: 'Question' },
            { value: 'wrong-address', label: 'Shipped to wrong address', icon: 'House' },
            { value: 'change-address', label: 'Need to change delivery address', icon: 'PencilSimple' },
            { value: 'not-received', label: 'Shows delivered but not received', icon: 'Warning' },
            { value: 'damaged-package', label: 'Package arrived damaged', icon: 'Warning' },
          ],
        },
      ],
      nextStep: 'details',
    },
    {
      id: 'details',
      title: 'More Details',
      questions: [
        {
          id: 'lastTrackingUpdate',
          text: 'When was the last tracking update?',
          type: 'select',
          required: true,
          showIf: { questionId: 'shippingIssue', value: ['tracking', 'delayed', 'lost'] },
          options: [
            { value: '1-2-days', label: '1-2 days ago' },
            { value: '3-5-days', label: '3-5 days ago' },
            { value: '1-week', label: 'About a week ago' },
            { value: 'over-week', label: 'Over a week ago' },
          ],
        },
        {
          id: 'newAddress',
          text: 'What\'s the new delivery address?',
          type: 'textarea',
          placeholder: 'Street address, city, state, zip code',
          required: true,
          showIf: { questionId: 'shippingIssue', value: 'change-address' },
        },
        {
          id: 'description',
          text: 'Any additional details?',
          type: 'textarea',
          placeholder: 'Tell us more...',
          required: false,
        },
      ],
    },
  ],
  generateSummary: (answers) => {
    const issues: Record<string, string> = {
      'tracking': 'Tracking not updating',
      'delayed': 'Shipment delayed',
      'lost': 'Package may be lost',
      'wrong-address': 'Wrong delivery address',
      'change-address': 'Address change request',
      'not-received': 'Not received (shows delivered)',
      'damaged-package': 'Package arrived damaged',
    };
    return issues[answers.shippingIssue] || 'Shipping issue';
  },
  getPriority: (answers) => {
    if (answers.shippingIssue === 'lost' || answers.shippingIssue === 'not-received') return 'HIGH';
    if (answers.lastTrackingUpdate === 'over-week') return 'HIGH';
    return 'MEDIUM';
  },
};

// ===== RETURNS & REFUNDS FLOW =====
export const returnsFlow: QuestionnaireFlow = {
  id: 'returns',
  ticketType: 'RETURN',
  name: 'Returns & Refunds',
  description: 'Return and refund requests',
  icon: 'ArrowUUpLeft',
  steps: [
    {
      id: 'request-type',
      title: 'What would you like to do?',
      questions: [
        {
          id: 'requestType',
          text: 'Select an option',
          type: 'select',
          required: true,
          options: [
            { value: 'return', label: 'Return item(s) for refund', icon: 'ArrowUUpLeft' },
            { value: 'exchange', label: 'Exchange for different size/color', icon: 'ArrowsLeftRight' },
            { value: 'refund-status', label: 'Check refund status', icon: 'MagnifyingGlass' },
            { value: 'return-status', label: 'Check return status', icon: 'Package' },
          ],
        },
      ],
      nextStep: 'order-select',
    },
    {
      id: 'order-select',
      title: 'Select Your Order',
      questions: [
        {
          id: 'orderId',
          text: 'Which order is this for?',
          type: 'order-select',
          required: true,
          mapToField: 'orderId',
        },
      ],
      nextStep: 'return-details',
    },
    {
      id: 'return-details',
      title: 'Return Details',
      questions: [
        {
          id: 'returnReason',
          text: 'Why are you returning this item?',
          type: 'select',
          required: true,
          showIf: { questionId: 'requestType', value: ['return', 'exchange'] },
          options: [
            { value: 'wrong-size', label: 'Wrong size' },
            { value: 'doesnt-fit', label: 'Doesn\'t fit as expected' },
            { value: 'not-as-pictured', label: 'Not as pictured' },
            { value: 'quality', label: 'Quality not as expected' },
            { value: 'defective', label: 'Item is defective' },
            { value: 'changed-mind', label: 'Changed my mind' },
            { value: 'other', label: 'Other' },
          ],
          mapToField: 'refundReason',
        },
        {
          id: 'itemCondition',
          text: 'What condition is the item in?',
          type: 'select',
          required: true,
          showIf: { questionId: 'requestType', value: ['return', 'exchange'] },
          options: [
            { value: 'unworn-tags', label: 'Unworn with tags attached' },
            { value: 'unworn-no-tags', label: 'Unworn, tags removed' },
            { value: 'tried-on', label: 'Tried on only' },
            { value: 'worn-once', label: 'Worn once' },
            { value: 'defective', label: 'Defective (photos available)' },
          ],
        },
        {
          id: 'exchangePreference',
          text: 'What would you like instead?',
          type: 'text',
          placeholder: 'e.g., Size M instead of Size L, or Black instead of Navy',
          required: true,
          showIf: { questionId: 'requestType', value: 'exchange' },
        },
        {
          id: 'description',
          text: 'Additional details',
          type: 'textarea',
          placeholder: 'Any other information we should know...',
          required: false,
        },
      ],
    },
  ],
  generateSummary: (answers) => {
    const types: Record<string, string> = {
      'return': 'Return request',
      'exchange': 'Exchange request',
      'refund-status': 'Refund status inquiry',
      'return-status': 'Return status inquiry',
    };
    const reasons: Record<string, string> = {
      'wrong-size': 'wrong size',
      'doesnt-fit': 'fit issue',
      'not-as-pictured': 'not as pictured',
      'quality': 'quality issue',
      'defective': 'defective item',
      'changed-mind': 'changed mind',
    };
    const type = types[answers.requestType] || 'Return request';
    const reason = reasons[answers.returnReason] ? ` - ${reasons[answers.returnReason]}` : '';
    return `${type}${reason}`;
  },
  getPriority: (answers) => {
    if (answers.returnReason === 'defective') return 'HIGH';
    return 'MEDIUM';
  },
};

// ===== PAYMENT ISSUES FLOW =====
export const paymentFlow: QuestionnaireFlow = {
  id: 'payment',
  ticketType: 'PAYMENT_ISSUE',
  name: 'Payment Issues',
  description: 'Payment and billing help',
  icon: 'CreditCard',
  steps: [
    {
      id: 'issue-type',
      title: 'Payment Issue',
      questions: [
        {
          id: 'paymentIssue',
          text: 'What\'s the payment issue?',
          type: 'select',
          required: true,
          options: [
            { value: 'double-charge', label: 'I was charged twice', icon: 'Warning' },
            { value: 'wrong-amount', label: 'Charged wrong amount', icon: 'Calculator' },
            { value: 'payment-failed', label: 'Payment failed but money taken', icon: 'X' },
            { value: 'refund-not-received', label: 'Refund not received', icon: 'Clock' },
            { value: 'promo-not-applied', label: 'Promo code not applied', icon: 'Ticket' },
            { value: 'other', label: 'Other payment issue', icon: 'DotsThree' },
          ],
        },
      ],
      nextStep: 'order-info',
    },
    {
      id: 'order-info',
      title: 'Order Information',
      questions: [
        {
          id: 'hasOrderNumber',
          text: 'Do you have an order number?',
          type: 'yesno',
          required: true,
        },
        {
          id: 'orderId',
          text: 'Select your order',
          type: 'order-select',
          required: true,
          showIf: { questionId: 'hasOrderNumber', value: 'yes' },
          mapToField: 'orderId',
        },
        {
          id: 'transactionDate',
          text: 'When did this transaction occur?',
          type: 'text',
          placeholder: 'e.g., December 28, 2025',
          required: true,
          showIf: { questionId: 'hasOrderNumber', value: 'no' },
        },
        {
          id: 'amount',
          text: 'What amount were you charged?',
          type: 'text',
          placeholder: 'e.g., $85.99',
          required: true,
          mapToField: 'refundAmount',
        },
      ],
      nextStep: 'details',
    },
    {
      id: 'details',
      title: 'Additional Information',
      questions: [
        {
          id: 'paymentMethod',
          text: 'Which payment method was used?',
          type: 'select',
          required: true,
          options: [
            { value: 'credit-card', label: 'Credit/Debit Card' },
            { value: 'paypal', label: 'PayPal' },
            { value: 'apple-pay', label: 'Apple Pay' },
            { value: 'google-pay', label: 'Google Pay' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'promoCode',
          text: 'What promo code did you try to use?',
          type: 'text',
          placeholder: 'Enter the promo code',
          required: true,
          showIf: { questionId: 'paymentIssue', value: 'promo-not-applied' },
        },
        {
          id: 'description',
          text: 'Please describe the issue',
          type: 'textarea',
          placeholder: 'Include any relevant details like last 4 digits of card, error messages, etc.',
          required: true,
        },
      ],
    },
  ],
  generateSummary: (answers) => {
    const issues: Record<string, string> = {
      'double-charge': 'Double charge reported',
      'wrong-amount': 'Incorrect charge amount',
      'payment-failed': 'Failed payment issue',
      'refund-not-received': 'Missing refund',
      'promo-not-applied': 'Promo code issue',
      'other': 'Payment issue',
    };
    return `${issues[answers.paymentIssue]} - ${answers.amount || 'Amount not specified'}`;
  },
  getPriority: (answers) => {
    if (answers.paymentIssue === 'double-charge') return 'URGENT';
    if (answers.paymentIssue === 'payment-failed') return 'HIGH';
    return 'MEDIUM';
  },
};

// ===== PRODUCT QUESTIONS FLOW =====
export const productFlow: QuestionnaireFlow = {
  id: 'product',
  ticketType: 'PRODUCT_QUESTION',
  name: 'Product Questions',
  description: 'Product information help',
  icon: 'TShirt',
  steps: [
    {
      id: 'question-type',
      title: 'Product Question',
      questions: [
        {
          id: 'questionType',
          text: 'What would you like to know?',
          type: 'select',
          required: true,
          options: [
            { value: 'sizing', label: 'Sizing help', icon: 'Ruler' },
            { value: 'material', label: 'Material & care info', icon: 'TShirt' },
            { value: 'availability', label: 'Stock availability', icon: 'Package' },
            { value: 'restock', label: 'Restock date', icon: 'Calendar' },
            { value: 'recommendation', label: 'Product recommendations', icon: 'Sparkle' },
            { value: 'other', label: 'Other question', icon: 'Question' },
          ],
        },
      ],
      nextStep: 'product-info',
    },
    {
      id: 'product-info',
      title: 'Product Information',
      questions: [
        {
          id: 'productName',
          text: 'Which product are you asking about?',
          type: 'text',
          placeholder: 'Product name or URL',
          required: true,
        },
        {
          id: 'sizingQuestion',
          text: 'What sizing help do you need?',
          type: 'textarea',
          placeholder: 'e.g., I\'m usually a Medium in Nike, what size should I get?',
          required: true,
          showIf: { questionId: 'questionType', value: 'sizing' },
        },
        {
          id: 'sizeNeeded',
          text: 'What size are you looking for?',
          type: 'text',
          placeholder: 'e.g., Size M or Size 10',
          required: true,
          showIf: { questionId: 'questionType', value: ['availability', 'restock'] },
        },
        {
          id: 'description',
          text: 'Your question',
          type: 'textarea',
          placeholder: 'Tell us what you\'d like to know...',
          required: true,
          showIf: { questionId: 'questionType', value: ['material', 'recommendation', 'other'] },
        },
      ],
    },
  ],
  generateSummary: (answers) => {
    const types: Record<string, string> = {
      'sizing': 'Sizing question',
      'material': 'Material inquiry',
      'availability': 'Stock check',
      'restock': 'Restock inquiry',
      'recommendation': 'Product recommendation',
      'other': 'Product question',
    };
    return `${types[answers.questionType]} - ${answers.productName || 'Product inquiry'}`;
  },
  getPriority: () => 'LOW',
};

// ===== LOYALTY FLOW =====
export const loyaltyFlow: QuestionnaireFlow = {
  id: 'loyalty',
  ticketType: 'GENERAL',
  name: 'Care Points & Rewards',
  description: 'Loyalty program help',
  icon: 'Heart',
  steps: [
    {
      id: 'issue-type',
      title: 'Loyalty Issue',
      questions: [
        {
          id: 'loyaltyIssue',
          text: 'What do you need help with?',
          type: 'select',
          required: true,
          options: [
            { value: 'points-missing', label: 'Points not credited', icon: 'Warning' },
            { value: 'wrong-tier', label: 'Tier status incorrect', icon: 'Crown' },
            { value: 'reward-issue', label: 'Problem redeeming reward', icon: 'Gift' },
            { value: 'referral', label: 'Referral bonus issue', icon: 'Users' },
            { value: 'points-expired', label: 'Points expired unexpectedly', icon: 'Clock' },
            { value: 'balance-question', label: 'Points balance question', icon: 'Question' },
          ],
        },
      ],
      nextStep: 'details',
    },
    {
      id: 'details',
      title: 'Details',
      questions: [
        {
          id: 'orderId',
          text: 'Which order should have earned points?',
          type: 'order-select',
          required: true,
          showIf: { questionId: 'loyaltyIssue', value: 'points-missing' },
          mapToField: 'orderId',
        },
        {
          id: 'expectedPoints',
          text: 'How many points were you expecting?',
          type: 'text',
          placeholder: 'e.g., 150 points',
          required: false,
          showIf: { questionId: 'loyaltyIssue', value: 'points-missing' },
        },
        {
          id: 'currentTier',
          text: 'What tier are you showing as?',
          type: 'select',
          required: true,
          showIf: { questionId: 'loyaltyIssue', value: 'wrong-tier' },
          options: [
            { value: 'head', label: 'Head' },
            { value: 'heart', label: 'Heart' },
            { value: 'mind', label: 'Mind' },
            { value: 'overdrive', label: 'Overdrive' },
          ],
        },
        {
          id: 'expectedTier',
          text: 'What tier should you be?',
          type: 'select',
          required: true,
          showIf: { questionId: 'loyaltyIssue', value: 'wrong-tier' },
          options: [
            { value: 'head', label: 'Head' },
            { value: 'heart', label: 'Heart' },
            { value: 'mind', label: 'Mind' },
            { value: 'overdrive', label: 'Overdrive' },
          ],
        },
        {
          id: 'rewardName',
          text: 'Which reward were you trying to redeem?',
          type: 'text',
          placeholder: 'e.g., $10 Off Coupon',
          required: true,
          showIf: { questionId: 'loyaltyIssue', value: 'reward-issue' },
        },
        {
          id: 'referralCode',
          text: 'What referral code was used?',
          type: 'text',
          placeholder: 'Enter the referral code',
          required: true,
          showIf: { questionId: 'loyaltyIssue', value: 'referral' },
        },
        {
          id: 'description',
          text: 'Please describe the issue',
          type: 'textarea',
          placeholder: 'Give us more details about what happened...',
          required: true,
        },
      ],
    },
  ],
  generateSummary: (answers) => {
    const issues: Record<string, string> = {
      'points-missing': 'Missing points',
      'wrong-tier': 'Tier status issue',
      'reward-issue': 'Reward redemption problem',
      'referral': 'Referral bonus issue',
      'points-expired': 'Points expiration issue',
      'balance-question': 'Points balance inquiry',
    };
    return issues[answers.loyaltyIssue] || 'Loyalty program issue';
  },
  getPriority: (answers) => {
    if (answers.loyaltyIssue === 'points-missing' || answers.loyaltyIssue === 'reward-issue') return 'MEDIUM';
    return 'LOW';
  },
};

// ===== ACCOUNT HELP FLOW =====
export const accountFlow: QuestionnaireFlow = {
  id: 'account',
  ticketType: 'GENERAL',
  name: 'Account Help',
  description: 'Account and login help',
  icon: 'User',
  steps: [
    {
      id: 'issue-type',
      title: 'Account Issue',
      questions: [
        {
          id: 'accountIssue',
          text: 'What do you need help with?',
          type: 'select',
          required: true,
          options: [
            { value: 'cant-login', label: 'Can\'t log in', icon: 'Lock' },
            { value: 'password-reset', label: 'Password reset not working', icon: 'Key' },
            { value: 'update-info', label: 'Update my information', icon: 'PencilSimple' },
            { value: 'delete-account', label: 'Delete my account', icon: 'Trash' },
            { value: 'merge-accounts', label: 'Merge accounts', icon: 'Users' },
            { value: 'other', label: 'Other account issue', icon: 'DotsThree' },
          ],
        },
      ],
      nextStep: 'details',
    },
    {
      id: 'details',
      title: 'Details',
      questions: [
        {
          id: 'accountEmail',
          text: 'What email is your account registered with?',
          type: 'email',
          placeholder: 'your@email.com',
          required: true,
        },
        {
          id: 'errorMessage',
          text: 'What error message do you see?',
          type: 'text',
          placeholder: 'Copy the error message if any',
          required: false,
          showIf: { questionId: 'accountIssue', value: ['cant-login', 'password-reset'] },
        },
        {
          id: 'updateType',
          text: 'What information needs updating?',
          type: 'multiselect',
          required: true,
          showIf: { questionId: 'accountIssue', value: 'update-info' },
          options: [
            { value: 'email', label: 'Email address' },
            { value: 'name', label: 'Name' },
            { value: 'phone', label: 'Phone number' },
            { value: 'address', label: 'Address' },
          ],
        },
        {
          id: 'description',
          text: 'Additional details',
          type: 'textarea',
          placeholder: 'Tell us more about your issue...',
          required: true,
        },
      ],
    },
  ],
  generateSummary: (answers) => {
    const issues: Record<string, string> = {
      'cant-login': 'Login issue',
      'password-reset': 'Password reset problem',
      'update-info': 'Account update request',
      'delete-account': 'Account deletion request',
      'merge-accounts': 'Account merge request',
      'other': 'Account issue',
    };
    return issues[answers.accountIssue] || 'Account help needed';
  },
  getPriority: (answers) => {
    if (answers.accountIssue === 'delete-account') return 'HIGH';
    return 'MEDIUM';
  },
};

// ===== GENERAL / OTHER FLOW =====
export const generalFlow: QuestionnaireFlow = {
  id: 'general',
  ticketType: 'GENERAL',
  name: 'Something Else',
  description: 'General questions',
  icon: 'ChatCircle',
  steps: [
    {
      id: 'details',
      title: 'How can we help?',
      questions: [
        {
          id: 'subject',
          text: 'What\'s your question about?',
          type: 'text',
          placeholder: 'Brief subject line',
          required: true,
          mapToField: 'subject',
        },
        {
          id: 'description',
          text: 'Please describe what you need help with',
          type: 'textarea',
          placeholder: 'Give us as much detail as possible so we can help you...',
          required: true,
          validation: { minLength: 30, message: 'Please provide at least 30 characters' },
        },
      ],
    },
  ],
  generateSummary: (answers) => answers.subject || 'General inquiry',
  getPriority: () => 'LOW',
};

// ===== FLOW REGISTRY =====
export const QUESTIONNAIRE_FLOWS: Record<string, QuestionnaireFlow> = {
  order: orderIssuesFlow,
  shipping: shippingFlow,
  return: returnsFlow,
  payment: paymentFlow,
  product: productFlow,
  loyalty: loyaltyFlow,
  account: accountFlow,
  other: generalFlow,
};

// ===== HELPER FUNCTIONS =====

/**
 * Get the flow for a given category
 */
export function getFlowForCategory(category: string): QuestionnaireFlow | null {
  return QUESTIONNAIRE_FLOWS[category] || null;
}

/**
 * Check if a question should be shown based on conditional logic
 */
export function shouldShowQuestion(question: Question, answers: Record<string, string>): boolean {
  if (!question.showIf) return true;
  
  const { questionId, value } = question.showIf;
  const answer = answers[questionId];
  
  if (Array.isArray(value)) {
    return value.includes(answer);
  }
  
  return answer === value;
}

/**
 * Get visible questions for a step based on current answers
 */
export function getVisibleQuestions(step: QuestionnaireStep, answers: Record<string, string>): Question[] {
  return step.questions.filter(q => shouldShowQuestion(q, answers));
}

/**
 * Validate a step's answers
 */
export function validateStep(step: QuestionnaireStep, answers: Record<string, string>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const visibleQuestions = getVisibleQuestions(step, answers);
  
  for (const question of visibleQuestions) {
    const answer = answers[question.id];
    
    if (question.required && (!answer || answer.trim() === '')) {
      errors[question.id] = 'This field is required';
      continue;
    }
    
    if (answer && question.validation) {
      if (question.validation.minLength && answer.length < question.validation.minLength) {
        errors[question.id] = question.validation.message || `Minimum ${question.validation.minLength} characters required`;
      }
      if (question.validation.maxLength && answer.length > question.validation.maxLength) {
        errors[question.id] = question.validation.message || `Maximum ${question.validation.maxLength} characters allowed`;
      }
      if (question.validation.pattern && !new RegExp(question.validation.pattern).test(answer)) {
        errors[question.id] = question.validation.message || 'Invalid format';
      }
    }
  }
  
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Map answers to ticket fields
 */
export function mapAnswersToTicketFields(flow: QuestionnaireFlow, answers: Record<string, string>): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    type: flow.ticketType,
    subject: flow.generateSummary(answers),
    priority: flow.getPriority(answers),
  };
  
  // Map specific answer fields to ticket fields
  for (const step of flow.steps) {
    for (const question of step.questions) {
      if (question.mapToField && answers[question.id]) {
        fields[question.mapToField] = answers[question.id];
      }
    }
  }
  
  return fields;
}
