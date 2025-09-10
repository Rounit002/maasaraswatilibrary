import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '../services/api';
import { Search, ChevronRight, Trash2, Eye, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Select from 'react-select';

// Comprehensive Student interface combining details from all pages
interface Student {
  id: number;
  name: string;
  registrationNumber?: string | null;
  fatherName?: string | null;
  aadharNumber?: string | null;
  email: string;
  phone: string;
  address?: string | null;
  branchId?: number;
  branchName?: string;
  status?: string;
  membershipStart?: string;
  membershipEnd: string;
  totalFee?: number;
  lockerFee?: number;
  amountPaid?: number;
  dueAmount?: number;
  cash?: number;
  online?: number;
  securityMoney?: number;
  remark?: string | null;
  profileImageUrl?: string | null;
  createdAt?: string;
  assignments?: Array<{
    seatId: number;
    shiftId: number;
    seatNumber: string;
    shiftTitle: string;
  }>;
  shiftId?: number;
  shiftTitle?: string;
  seatId?: number;
  seatNumber?: string;
  lockerId?: number | null;
  lockerNumber?: string | null;
  discount?: number;
}

interface Seat {
  id: number;
  seatNumber: string;
  studentId?: number | null;
}

interface Schedule {
    id: number;
    title: string;
    fee: number;
}

interface ShiftOption {
    value: number;
    label: string;
    fee: number;
    isDisabled?: boolean;
}

interface Locker {
  id: number;
  lockerNumber: string;
  isAssigned: boolean;
  studentId?: number | null;
}

const hasPermissions = (user: any): user is { permissions: string[] } => {
  return user && 'permissions' in user && Array.isArray(user.permissions);
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toISOString().split('T')[0];
};

const ExpiredMemberships = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // State for the new branch filter
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<{ value: number | null; label: string } | null>(null);
  const [branchFilterOptions, setBranchFilterOptions] = useState<any[]>([]);

  // State for all form fields
  const [nameInput, setNameInput] = useState('');
  const [registrationNumberInput, setRegistrationNumberInput] = useState('');
  const [fatherNameInput, setFatherNameInput] = useState('');
  const [aadharNumberInput, setAadharNumberInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addMonths(new Date(), 1));
  
  const [allShifts, setAllShifts] = useState<ShiftOption[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [seatOptions, setSeatOptions] = useState<any[]>([]);
  const [branchOptions, setBranchOptions] = useState<any[]>([]);
  const [lockerOptions, setLockerOptions] = useState<any[]>([]);
  
  const [selectedShifts, setSelectedShifts] = useState<ShiftOption[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [selectedLocker, setSelectedLocker] = useState<any>(null);
  
  const [totalFee, setTotalFee] = useState<string>('');
  const [cash, setCash] = useState<string>('');
  const [online, setOnline] = useState<string>('');
  const [securityMoney, setSecurityMoney] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [lockerFee, setLockerFee] = useState<string>('');

  const [loadingSeats, setLoadingSeats] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [loadingLockers, setLoadingLockers] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  // Effect to fetch supporting data (for filters and dialogs) once on component mount
  useEffect(() => {
    (async () => {
      try {
        const [shiftsResp, branchesResp] = await Promise.all([
          api.getSchedules(),
          api.getBranches(),
        ]);

        const formattedShifts = shiftsResp.schedules.map((shift: any) => ({
             value: shift.id, 
             label: `${shift.title} - [Fee: ${shift.fee}]`,
             fee: shift.fee ?? 0
        }));
        setAllShifts(formattedShifts);
        setShiftOptions(formattedShifts);
        
        setBranchOptions(branchesResp.map((branch: any) => ({ value: branch.id, label: branch.name })));
        
        setBranchFilterOptions([
          { value: null, label: 'All Branches' },
          ...branchesResp.map((branch: any) => ({ value: branch.id, label: branch.name }))
        ]);
      } catch (e: any) {
        console.error('Error fetching supporting data:', e);
        toast.error(e.message || 'Failed to fetch supporting data.');
      }
    })();
  }, []);

  // Effect to fetch expired students when the component mounts or the branch filter changes
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const studentsResp = await api.getExpiredMemberships(selectedBranchFilter?.value);
        setStudents(studentsResp.students);
      } catch (e: any) {
        console.error('Error fetching expired memberships:', e);
        toast.error(e.message || 'Failed to fetch expired memberships.');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedBranchFilter]);

  // Effect to fetch seats and lockers when a branch is selected in the dialog
  useEffect(() => {
    const fetchBranchSpecificData = async () => {
      if (selectedBranch?.value && selectedStudent) {
        setLoadingSeats(true);
        setLoadingLockers(true);
        try {
          const seatsPromise = api.getSeats({ branchId: selectedBranch.value });
          const lockersPromise = api.getLockers(selectedBranch.value);
          const [seatsResponse, lockersResponse] = await Promise.all([seatsPromise, lockersPromise]);
          
          const allSeats: Seat[] = seatsResponse.seats;
          const availableSeats = allSeats.filter(seat => !seat.studentId || seat.studentId === selectedStudent.id);
          setSeatOptions([
            { value: null, label: 'None' },
            ...availableSeats.map(seat => ({ value: seat.id, label: seat.seatNumber }))
          ]);

          const allLockerItems: Locker[] = lockersResponse.lockers;
          const availableLockers = allLockerItems.filter(locker => !locker.isAssigned || locker.studentId === selectedStudent.id);
          setLockerOptions([
              { value: null, label: 'None' },
              ...availableLockers.map(locker => ({ value: locker.id, label: locker.lockerNumber }))
          ]);

        } catch (error) {
          console.error('Error fetching seats and lockers for branch:', error);
          toast.error('Failed to fetch seats and lockers');
        } finally {
          setLoadingSeats(false);
          setLoadingLockers(false);
        }
      } else {
        setSeatOptions([{ value: null, label: 'None' }]);
        setLockerOptions([{ value: null, label: 'None' }]);
      }
    };
    if (renewDialogOpen) {
      fetchBranchSpecificData();
    }
  }, [selectedBranch, selectedStudent, renewDialogOpen]);

  // Effect to fetch available shifts when a seat is selected
  useEffect(() => {
    const fetchAvailableShiftsForSeat = async () => {
      if (!selectedSeat?.value) {
        // When no seat is selected (seat is "none"), show all shifts as available
        setShiftOptions(allShifts.map(s => ({ ...s, isDisabled: false })));
        return;
      }
      setLoadingShifts(true);
      try {
        const response = await api.getAvailableShifts(selectedSeat.value);
        const availableShiftIds = new Set(response.availableShifts.map((s: any) => s.id));
        
        const studentCurrentShiftIds = selectedStudent?.assignments?.map(a => a.shiftId) ?? [];
        studentCurrentShiftIds.forEach(id => availableShiftIds.add(id));

        const newShiftOptions = allShifts.map(shift => ({
          ...shift,
          label: `${shift.label.split(' - ')[0]} ${availableShiftIds.has(shift.value) ? '(Available)' : '(Assigned)'}`,
          isDisabled: !availableShiftIds.has(shift.value),
        }));
        setShiftOptions(newShiftOptions);

        setSelectedShifts(prev => prev.filter(s => availableShiftIds.has(s.value)));
      } catch (error) {
        console.error('Failed to fetch available shifts:', error);
        toast.error('Failed to load available shifts.');
      } finally {
        setLoadingShifts(false);
      }
    };
    if (renewDialogOpen) {
      fetchAvailableShiftsForSeat();
    }
  }, [selectedSeat, allShifts, selectedStudent, renewDialogOpen]);
  
  // Effect to auto-calculate membership fee when one shift is selected
  useEffect(() => {
      if (selectedShifts.length === 1) {
          const selectedShiftDetail = allShifts.find(shift => shift.value === selectedShifts[0].value);
          const shiftFee = selectedShiftDetail ? selectedShiftDetail.fee : 0;
          setTotalFee(shiftFee.toString());
      } else {
          setTotalFee('0');
      }
  }, [selectedShifts, allShifts]);

  const handleRenewClick = async (student: Student) => {
    try {
        setLoading(true);
        const fullStudentDetails = await api.getStudent(student.id);
        setSelectedStudent(fullStudentDetails);

        setStartDate(new Date());
        setEndDate(addMonths(new Date(), 1));

        setNameInput(fullStudentDetails.name || '');
        setRegistrationNumberInput(fullStudentDetails.registrationNumber || '');
        setFatherNameInput(fullStudentDetails.fatherName || '');
        setAadharNumberInput(fullStudentDetails.aadharNumber || '');
        setEmailInput(fullStudentDetails.email || '');
        setPhoneInput(fullStudentDetails.phone || '');
        setAddressInput(fullStudentDetails.address || '');
        setSelectedBranch(fullStudentDetails.branchId ? { value: fullStudentDetails.branchId, label: fullStudentDetails.branchName } : null);
        
        const currentAssignment = fullStudentDetails.assignments?.[0];
        setSelectedSeat(currentAssignment ? { value: currentAssignment.seatId, label: currentAssignment.seatNumber } : null);
        
        const currentShifts = fullStudentDetails.assignments?.map(a => {
          const shiftDetail = allShifts.find(shift => shift.value === a.shiftId);
          return {
            value: a.shiftId,
            label: a.shiftTitle,
            fee: shiftDetail?.fee ?? 0
          };
        }) ?? [];
        setSelectedShifts(currentShifts);
        
        setTotalFee(fullStudentDetails.totalFee ? fullStudentDetails.totalFee.toString() : '0');
        setLockerFee(fullStudentDetails.lockerFee ? fullStudentDetails.lockerFee.toString() : '0');
        setCash(fullStudentDetails.cash ? fullStudentDetails.cash.toString() : '0');
        setOnline(fullStudentDetails.online ? fullStudentDetails.online.toString() : '0');
        setSecurityMoney(fullStudentDetails.securityMoney ? fullStudentDetails.securityMoney.toString() : '0');
        setRemark(fullStudentDetails.remark || '');
        
        setSelectedLocker(fullStudentDetails.lockerId ? { value: fullStudentDetails.lockerId, label: fullStudentDetails.lockerNumber } : null);
        setDiscount(fullStudentDetails.discount ? fullStudentDetails.discount.toString() : '0');

        setRenewDialogOpen(true);
    } catch (error) {
        console.error("Failed to fetch student details for renewal:", error);
        toast.error("Failed to load student details for renewal.");
    } finally {
        setLoading(false);
    }
  };

  const handleLockerChange = (option: any) => {
    setSelectedLocker(option);
    if (!option) {
        setLockerFee('0');
    }
  };

  const handleShiftChange = (options: any) => {
    const newSelectedShifts = options || [];
    setSelectedShifts(newSelectedShifts);
  };

  const handleWhatsAppClick = (phone: string) => {
    const formattedPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${formattedPhone}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleRenewSubmit = async () => {
    if (
      !selectedStudent || !startDate || !endDate ||
      !nameInput.trim() || !phoneInput.trim() || !addressInput.trim() ||
      !totalFee || !selectedBranch?.value || selectedShifts.length === 0
    ) {
      toast.error('Please fill all required fields. At least one shift must be selected.');
      return;
    }

    try {
      await api.renewStudent(selectedStudent.id, {
        name: nameInput,
        registrationNumber: registrationNumberInput,
        fatherName: fatherNameInput,
        aadharNumber: aadharNumberInput,
        address: addressInput,
        membershipStart: format(startDate, 'yyyy-MM-dd'),
        membershipEnd: format(endDate, 'yyyy-MM-dd'),
        email: emailInput,
        phone: phoneInput,
        branchId: selectedBranch.value,
        shiftIds: selectedShifts.map(s => s.value),
        seatId: selectedSeat ? selectedSeat.value : undefined,
        lockerId: selectedLocker ? selectedLocker.value : undefined,
        lockerFee: parseFloat(lockerFee) || 0,
        discount: parseFloat(discount) || undefined,
        totalFee: parseFloat(totalFee),
        cash: parseFloat(cash) || 0,
        online: parseFloat(online) || 0,
        securityMoney: parseFloat(securityMoney) || 0,
        remark: remark.trim() || undefined,
      });

      toast.success(`Membership renewed for ${selectedStudent.name}`);
      setRenewDialogOpen(false);

      const resp = await api.getExpiredMemberships(selectedBranchFilter?.value);
      setStudents(resp.students);

    } catch (err: any) {
      console.error('Renew error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to renew membership');
    }
  };

  const cashAmount = parseFloat(cash) || 0;
  const onlineAmount = parseFloat(online) || 0;
  const paid = cashAmount + onlineAmount;
  const discountAmount = parseFloat(discount) || 0;
  const due = (parseFloat(totalFee) || 0) - discountAmount - paid;
  const isFeeReadOnly = selectedShifts.length === 1;

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Navbar />
        <div className="flex-1 p-4">
          <h2 className="text-xl font-semibold mb-4">Expired Memberships</h2>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" />
              <input
                className="pl-10 pr-4 py-2 border rounded"
                placeholder="Search by name, phone, or Reg. No."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-64">
              <Select
                options={branchFilterOptions}
                value={selectedBranchFilter}
                onChange={setSelectedBranchFilter}
                placeholder="Filter by Branch"
                isClearable
              />
            </div>
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Registration Number</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students
                  .filter(
                    (s) =>
                      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (s.phone && s.phone.includes(searchTerm)) ||
                      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.registrationNumber || 'N/A'}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.phone}</TableCell>
                      <TableCell>{formatDate(student.membershipEnd)}</TableCell>
                      <TableCell className="space-x-2">
                        <Button onClick={() => navigate(`/students/${student.id}`)} variant="outline">
                          <Eye size={16} />
                        </Button>
                        {(user?.role === 'admin' || user?.role === 'staff') && (
                          <Button onClick={() => handleRenewClick(student)}>
                            <ChevronRight size={16} /> Renew
                          </Button>
                        )}
                        {(user?.role === 'admin' ||
                          (hasPermissions(user) && user.permissions.includes('manage_students'))) && (
                          <Button
                            variant="destructive"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
                                try {
                                    await api.deleteStudent(student.id);
                                    setStudents(students.filter((s) => s.id !== student.id));
                                    toast.success('Student deleted successfully.');
                                } catch(err: any) {
                                    toast.error(err.message || "Failed to delete student.");
                                }
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          onClick={() => handleWhatsAppClick(student.phone)}
                          title="Send WhatsApp Message"
                        >
                          <MessageCircle size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Renewal Dialog */}
        <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Renew Membership</DialogTitle>
              <DialogDescription>Renew for {selectedStudent?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <div>
                <label className="block text-sm font-medium">Name</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
               <div>
                <label className="block text-sm font-medium">Registration Number</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="text"
                  value={registrationNumberInput}
                  onChange={(e) => setRegistrationNumberInput(e.target.value)}
                />
              </div>
               <div>
                <label className="block text-sm font-medium">Father's Name</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="text"
                  value={fatherNameInput}
                  onChange={(e) => setFatherNameInput(e.target.value)}
                />
              </div>
                <div>
                <label className="block text-sm font-medium">Aadhar Number</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="text"
                  value={aadharNumberInput}
                  onChange={(e) => setAadharNumberInput(e.target.value)}
                />
              </div>
                <div>
                <label className="block text-sm font-medium">Address</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Start Date</label>
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="rounded-md border"/>
              </div>
              <div>
                <label className="block text-sm font-medium">End Date</label>
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="rounded-md border"/>
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Phone</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Branch</label>
                <Select
                  options={branchOptions}
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  placeholder="Select Branch"
                />
              </div>
               <div>
                <label className="block text-sm font-medium">Seat</label>
                <Select
                  options={seatOptions}
                  value={selectedSeat}
                  onChange={(option) => {
                      setSelectedSeat(option);
                      setSelectedShifts([]);
                  }}
                  placeholder="Select Seat"
                  isLoading={loadingSeats}
                  isDisabled={!selectedBranch}
                  isClearable
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Shift</label>
                <Select
                  isMulti
                  options={shiftOptions}
                  value={selectedShifts}
                  onChange={handleShiftChange}
                  placeholder="Select Shifts"
                  isLoading={loadingShifts}
                  isDisabled={false}
                />
              </div>
               <div>
                  <label className="block text-sm font-medium">Locker</label>
                  <Select
                      options={lockerOptions}
                      value={selectedLocker}
                      onChange={handleLockerChange}
                      placeholder="Select Locker"
                      isLoading={loadingLockers}
                      isDisabled={!selectedBranch}
                      isClearable
                  />
              </div>
              {selectedLocker && (
                  <div>
                      <label className="block text-sm font-medium">Locker Fee</label>
                      <input
                          className="w-full border rounded px-3 py-2 mt-1"
                          type="number"
                          value={lockerFee}
                          onChange={(e) => setLockerFee(e.target.value)}
                          min="0"
                          step="0.01"
                      />
                  </div>
              )}
              <div>
                <label className="block text-sm font-medium">Membership Fee</label>
                <input
                  className={`w-full border rounded px-3 py-2 mt-1 ${isFeeReadOnly ? 'bg-gray-100' : ''}`}
                  type="number"
                  value={totalFee}
                  onChange={(e) => setTotalFee(e.target.value)}
                  readOnly={isFeeReadOnly}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                  <label className="block text-sm font-medium">Discount</label>
                  <input
                      className="w-full border rounded px-3 py-2 mt-1"
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      min="0"
                      step="0.01"
                  />
              </div>
              <div>
                <label className="block text-sm font-medium">Cash Payment</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="number"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Online Payment</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="number"
                  value={online}
                  onChange={(e) => setOnline(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Security Money</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1"
                  type="number"
                  value={securityMoney}
                  onChange={(e) => setSecurityMoney(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Amount Paid</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1 bg-gray-100"
                  type="number"
                  value={paid.toFixed(2)}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Due Amount</label>
                <input
                  className="w-full border rounded px-3 py-2 mt-1 bg-gray-100"
                  type="number"
                  value={due.toFixed(2)}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Remark</label>
                <textarea
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRenewSubmit}>Renew Membership</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ExpiredMemberships;