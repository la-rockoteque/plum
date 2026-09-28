// Package before: a pluggable CancellationPolicy registry, hooks and a config flag — for one policy that exists.
package before

const CancellationWindowMs = 24 * 60 * 60 * 1000

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

type Order struct {
	ID         int
	Status     OrderStatus
	PlacedAtMs int64
}

type Clock interface {
	NowMs() int64
}

type CancellationPolicy interface {
	CanCancel(order Order, clock Clock) bool
}

// StandardCancellationPolicy is the only policy that has ever existed.
type StandardCancellationPolicy struct{}

func (StandardCancellationPolicy) CanCancel(order Order, clock Clock) bool {
	if order.Status != Pending {
		return false
	}
	return clock.NowMs()-order.PlacedAtMs <= CancellationWindowMs
}

// CancellationHooks are extension points nobody has ever wired up.
type CancellationHooks struct {
	OnBeforeCancel []func(Order)
	OnAfterCancel  []func(Order)
}

const DefaultPolicyName = "standard"

// CancellationPolicyRegistry is a pluggable seam for a second policy that has never shown up.
type CancellationPolicyRegistry struct {
	policies map[string]CancellationPolicy
}

func NewCancellationPolicyRegistry() *CancellationPolicyRegistry {
	return &CancellationPolicyRegistry{
		policies: map[string]CancellationPolicy{DefaultPolicyName: StandardCancellationPolicy{}},
	}
}

func (r *CancellationPolicyRegistry) Register(name string, policy CancellationPolicy) {
	r.policies[name] = policy
}

func (r *CancellationPolicyRegistry) Resolve(name string) CancellationPolicy {
	// A typo in `name` is silently swallowed: it just falls back to the default.
	if policy, ok := r.policies[name]; ok {
		return policy
	}
	return r.policies[DefaultPolicyName]
}

type OrderCancellationService struct {
	Hooks      CancellationHooks
	StrictMode bool // dead: nothing reads this flag
	policy     CancellationPolicy
}

func NewOrderCancellationService(policyName string, registry *CancellationPolicyRegistry) *OrderCancellationService {
	if registry == nil {
		registry = NewCancellationPolicyRegistry()
	}
	if policyName == "" {
		policyName = DefaultPolicyName
	}
	return &OrderCancellationService{policy: registry.Resolve(policyName)}
}

func (s *OrderCancellationService) CanCancel(order Order, clock Clock) bool {
	for _, hook := range s.Hooks.OnBeforeCancel {
		hook(order)
	}
	result := s.policy.CanCancel(order, clock)
	for _, hook := range s.Hooks.OnAfterCancel {
		hook(order)
	}
	return result
}
