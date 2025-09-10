import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { Loader2 } from 'lucide-react';

// Interface for a single collection record
interface Collection {
  historyId: number;
  studentId: number;
  name: string;
  shiftTitle: string | null;
  totalFee: number;
  amountPaid: number;
  dueAmount: number;
  cash: number;
  online: number;
  securityMoney: number;
  remark: string;
  createdAt: string | null;
  branchId?: number;
  branchName?: string;
}

// Interface for the branch filter
interface Branch {
  id: number;
  name: string;
}

const CollectionDue: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // State for UI and filters
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  // State for the payment modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | null>(null);

  // Fetch branches for the filter dropdown
  useEffect(() => {
    api.getBranches().then(setBranches).catch(() => toast.error('Failed to load branches'));
  }, []);

  // --- Data Fetching with React Query ---

  // QUERY 1: Fetch the list of individual collections
  const { data: collectionsData, isLoading: isCollectionsLoading } = useQuery({
    queryKey: ['collections', selectedMonth, selectedBranchId],
    queryFn: () => api.getCollections({ month: selectedMonth, branchId: selectedBranchId || undefined }),
  });

  // QUERY 2: Fetch aggregate financial statistics (ADMINS ONLY)
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ['collectionStats', selectedMonth, selectedBranchId],
    queryFn: () => api.getCollectionStats({ month: selectedMonth, branchId: selectedBranchId || undefined }),
    enabled: !!user && user.role === 'admin',
  });

  // --- Mutations ---

  const paymentMutation = useMutation({
    mutationFn: (variables: { historyId: number; amount: number; method: 'cash' | 'online' }) =>
      api.updateCollectionPayment(variables.historyId, { amount: variables.amount, method: variables.method }),
    onSuccess: () => {
      toast.success('Payment updated successfully');
      setIsPayModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (user?.role === 'admin') {
        queryClient.invalidateQueries({ queryKey: ['collectionStats'] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update payment');
    },
  });

  // --- Event Handlers ---

  const handlePayDue = (collection: Collection) => {
    setSelectedCollection(collection);
    setPaymentAmount(collection.dueAmount.toFixed(2));
    setPaymentMethod(null);
    setIsPayModalOpen(true);
  };

  const handlePaymentSubmit = () => {
    if (!selectedCollection || !paymentMethod || !paymentAmount) {
      toast.error('Please select a payment method and enter a payment amount');
      return;
    }
    const payment = parseFloat(paymentAmount);
    if (isNaN(payment) || payment <= 0 || payment > selectedCollection.dueAmount + 0.01) {
      toast.error('Invalid payment amount. Cannot be zero or more than the due amount.');
      return;
    }
    paymentMutation.mutate({
      historyId: selectedCollection.historyId,
      amount: payment,
      method: paymentMethod,
    });
  };

  // Filter collections locally for the search bar
  const filteredCollections = collectionsData?.collections.filter(col =>
    col.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  // Get total students count from the unfiltered data
  const totalStudents = collectionsData?.collections.length || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#fef9f6]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <motion.div
          className="max-w-7xl mx-auto"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">📊 Collection & Due</h1>
          
          <div className="mb-6 flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
            <input
              type="text"
              placeholder="Search by student name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 p-2 border rounded-md"
            />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-2 border rounded-md"
            />
            <select
              value={selectedBranchId || ''}
              onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
              className="p-2 border rounded-md"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>

          {/* CONDITIONAL ADMIN-ONLY STATS BLOCK */}
          {user?.role === 'admin' && (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              <StatCard title="Total Students" value={totalStudents} isLoading={isCollectionsLoading} />
              <StatCard title="Total Collected" value={statsData?.totalPaid} isLoading={isStatsLoading} isCurrency color="text-green-600" />
              <StatCard title="Total Due" value={statsData?.totalDue} isLoading={isStatsLoading} isCurrency color="text-red-600" />
              <StatCard title="Cash Collected" value={statsData?.totalCash} isLoading={isStatsLoading} isCurrency color="text-blue-600" />
              <StatCard title="Online Collected" value={statsData?.totalOnline} isLoading={isStatsLoading} isCurrency color="text-purple-600" />
              <StatCard title="Security Money" value={statsData?.totalSecurityMoney} isLoading={isStatsLoading} isCurrency color="text-orange-500" />
            </motion.div>
          )}

          <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
            {isCollectionsLoading ? (
              <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cash</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Online</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Security</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remark</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCollections.length === 0 ? (
                    <tr><td colSpan={12} className="px-4 py-4 text-center text-gray-500">No collections found.</td></tr>
                  ) : (
                    filteredCollections.map((collection) => (
                      <tr key={collection.historyId}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">{collection.name}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{collection.branchName || 'N/A'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{collection.shiftTitle || 'N/A'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">₹{collection.totalFee.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">₹{collection.cash.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">₹{collection.online.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800">₹{collection.securityMoney.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600">₹{collection.amountPaid.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-red-600">₹{collection.dueAmount.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-wrap text-sm text-gray-500">{collection.remark || 'N/A'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{collection.createdAt ? new Date(collection.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {collection.dueAmount > 0 && (
                            <button onClick={() => handlePayDue(collection)} className="text-purple-600 hover:text-purple-800 font-medium">Pay Due</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        {/* Payment Modal */}
        {isPayModalOpen && selectedCollection && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Pay Due for {selectedCollection.name}</h3>
              <p className="text-sm text-gray-600 mb-2">Total Due Amount: ₹{selectedCollection.dueAmount.toFixed(2)}</p>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Payment Method:</p>
                <div className="flex space-x-4">
                  <label className="flex items-center"><input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="mr-2" />Cash</label>
                  <label className="flex items-center"><input type="radio" name="paymentMethod" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} className="mr-2" />Online</label>
                </div>
              </div>
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter payment amount" className="w-full p-2 border rounded-md mb-4" max={selectedCollection.dueAmount.toString()} />
              <div className="flex justify-end space-x-2">
                <button onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 border rounded-md">Cancel</button>
                <button onClick={handlePaymentSubmit} disabled={paymentMutation.isPending} className="px-4 py-2 bg-purple-600 text-white rounded-md disabled:bg-purple-300">
                  {paymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for rendering the stat cards for admins
const StatCard = ({ title, value, isLoading, isCurrency = false, color = 'text-gray-800' }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <div className={`text-xl font-bold ${color}`}>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isCurrency ? `₹${(value || 0).toFixed(2)}` : (value || 0))}
    </div>
  </div>
);

export default CollectionDue;
