module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdmin, checkAdminOrStaff } = require('./auth');
  const { checkPermissions } = require('./auth');

  const withCalculatedStatus = (selectFields = 's.*') => `
    SELECT
      ${selectFields},
      CASE
        WHEN s.membership_end < CURRENT_DATE THEN 'expired'
        ELSE 'active'
      END AS status
    FROM students s
  `;

  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      
      let query = `
        SELECT
          s.id, s.name, s.phone, s.registration_number, s.father_name, s.aadhar_number,
          s.is_active, s.profile_image_url, s.aadhaar_front_url, s.aadhaar_back_url,
          TO_CHAR(s.membership_end, 'YYYY-MM-DD') AS membership_end,
          TO_CHAR(s.created_at, 'YYYY-MM-DD') AS created_at,
          s.discount,
          CASE
            WHEN s.membership_end < CURRENT_DATE THEN 'expired'
            ELSE 'active'
          END AS status,
          (SELECT seats.seat_number FROM seat_assignments sa LEFT JOIN seats ON sa.seat_id = seats.id WHERE sa.student_id = s.id ORDER BY sa.id DESC LIMIT 1) AS seat_number,
          l.locker_number
        FROM students s
        LEFT JOIN locker l ON s.locker_id = l.id
      `;
      const params = [];

      if (branchIdNum) {
        query += ` WHERE s.branch_id = $1`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.name`;
      
      const result = await pool.query(query, params);
      res.json({ students: result.rows });
    } catch (err) {
      console.error('Error fetching students:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.get('/inactive', checkAdminOrStaff, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT s.id, s.name, s.phone, s.registration_number, s.is_active, b.name as branch_name 
        FROM students s
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.is_active = false 
        ORDER BY s.name
      `);
      res.json({ students: result.rows });
    } catch (err) {
      console.error('Error fetching inactive students:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.put('/:id/status', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      const { is_active } = req.body;

      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ message: 'is_active must be a boolean value.' });
      }

      const updatedStudent = await client.query(
        'UPDATE students SET is_active = $1 WHERE id = $2 RETURNING *',
        [is_active, id]
      );

      if (updatedStudent.rowCount === 0) {
        return res.status(404).json({ message: 'Student not found.' });
      }

      if (is_active === false) {
        await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
        await client.query('UPDATE students SET locker_id = NULL WHERE id = $1', [id]);
        await client.query('UPDATE locker SET is_assigned = false, student_id = NULL WHERE student_id = $1', [id]);
      }
      
      await client.query('COMMIT');
      res.json({ student: updatedStudent.rows[0], message: `Student status updated to ${is_active ? 'active' : 'inactive'}.` });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating student status:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  router.get('/active', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      let query = withCalculatedStatus();
      const params = [];

      query += ` WHERE s.membership_end >= CURRENT_DATE`;
      if (branchIdNum) {
        query += ` AND s.branch_id = $1`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.name`;

      const result = await pool.query(query, params);
      const students = result.rows.map(student => ({
        ...student,
        membership_start: new Date(student.membership_start).toISOString().split('T')[0],
        membership_end: new Date(student.membership_end).toISOString().split('T')[0],
        total_fee: parseFloat(student.total_fee || 0),
        amount_paid: parseFloat(student.amount_paid || 0),
        due_amount: parseFloat(student.due_amount || 0),
        cash: parseFloat(student.cash || 0),
        online: parseFloat(student.online || 0),
        security_money: parseFloat(student.security_money || 0),
        discount: parseFloat(student.discount || 0),
        remark: student.remark || '',
        profile_image_url: student.profile_image_url || '',
        aadhaar_front_url: student.aadhaar_front_url || '',
        aadhaar_back_url: student.aadhaar_back_url || '',
      }));
      res.json({ students });
    } catch (err) {
      console.error('Error in students/active route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.get('/expired', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      let query = `
        SELECT
            s.*,
            b.name as branch_name,
            (SELECT sa_latest.shift_id FROM seat_assignments sa_latest WHERE sa_latest.student_id = s.id ORDER BY sa_latest.id DESC LIMIT 1) as shift_id,
            (SELECT sch.title FROM seat_assignments sa_latest JOIN schedules sch ON sa_latest.shift_id = sch.id WHERE sa_latest.student_id = s.id ORDER BY sa_latest.id DESC LIMIT 1) as shift_title,
            (SELECT sa_latest.seat_id FROM seat_assignments sa_latest WHERE sa_latest.student_id = s.id ORDER BY sa_latest.id DESC LIMIT 1) as seat_id,
            (SELECT st.seat_number FROM seat_assignments sa_latest JOIN seats st ON sa_latest.seat_id = st.id WHERE sa_latest.student_id = s.id ORDER BY sa_latest.id DESC LIMIT 1) as seat_number,
            l.locker_number,
            CASE
                WHEN s.membership_end < CURRENT_DATE THEN 'expired'
                ELSE 'active'
            END AS status
        FROM students s
        LEFT JOIN branches b ON s.branch_id = b.id
        LEFT JOIN locker l ON s.locker_id = l.id
        WHERE s.membership_end < CURRENT_DATE
      `;
      const params = [];
      
      if (branchIdNum) {
        query += ` AND s.branch_id = $1`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.name`;

      const result = await pool.query(query, params);
      const students = result.rows.map(student => ({
        ...student,
        membership_start: new Date(student.membership_start).toISOString().split('T')[0],
        membership_end: new Date(student.membership_end).toISOString().split('T')[0],
        total_fee: parseFloat(student.total_fee || 0),
        amount_paid: parseFloat(student.amount_paid || 0),
        due_amount: parseFloat(student.due_amount || 0),
        cash: parseFloat(student.cash || 0),
        online: parseFloat(student.online || 0),
        security_money: parseFloat(student.security_money || 0),
        discount: parseFloat(student.discount || 0),
        remark: student.remark || '',
        profile_image_url: student.profile_image_url || '',
        aadhaar_front_url: student.aadhaar_front_url || '',
        aadhaar_back_url: student.aadhaar_back_url || '',
      }));
      res.json({ students });
    } catch (err) {
      console.error('Error in students/expired route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.get('/expiring-soon', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
      
      let query = `
        SELECT
          s.id,
          s.name,
          s.phone,
          TO_CHAR(s.membership_end, 'YYYY-MM-DD') AS membership_end,
          CASE
            WHEN s.membership_end < CURRENT_DATE THEN 'expired'
            ELSE 'active'
          END AS status,
          (SELECT seats.seat_number
           FROM seat_assignments sa
           LEFT JOIN seats ON sa.seat_id = seats.id
           WHERE sa.student_id = s.id
           ORDER BY sa.id DESC
           LIMIT 1) AS seat_number,
          l.locker_number
        FROM students s
        LEFT JOIN locker l ON s.locker_id = l.id
        WHERE s.membership_end >= CURRENT_DATE AND s.membership_end <= $1
      `;
      const params = [fiveDaysFromNow];
      
      if (branchIdNum) {
        query += ` AND s.branch_id = $2`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.membership_end`;

      const result = await pool.query(query, params);
      res.json({ students: result.rows });
    } catch (err) {
      console.error('Error in students/expiring-soon route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.get('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const queryText = `
        SELECT
          s.id,
          s.name,
          s.email,
          s.phone,
          s.address,
          s.registration_number,
          s.father_name,
          s.aadhar_number,
          s.is_active,
          s.profile_image_url,
          s.aadhaar_front_url,
          s.aadhaar_back_url,
          s.status,
          TO_CHAR(s.membership_start, 'YYYY-MM-DD') AS membership_start,
          TO_CHAR(s.membership_end, 'YYYY-MM-DD') AS membership_end,
          s.total_fee,
          s.amount_paid,
          s.due_amount,
          s.cash,
          s.online,
          s.security_money,
          s.remark,
          s.discount,
          s.locker_fee,
          b.name as branch_name,
          l.locker_number
        FROM students s
        LEFT JOIN branches b ON s.branch_id = b.id
        LEFT JOIN locker l ON s.locker_id = l.id
        WHERE s.id = $1
      `;
      const result = await pool.query(queryText, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Student not found' });
      }
      const studentData = result.rows[0];
      const assignments = await pool.query(`
        SELECT sa.seat_id, sa.shift_id, seats.seat_number, sch.title AS shift_title
        FROM seat_assignments sa
        LEFT JOIN seats ON sa.seat_id = seats.id
        LEFT JOIN schedules sch ON sa.shift_id = sch.id
        WHERE sa.student_id = $1
      `, [id]);
      res.json({
        ...studentData,
        membership_start: new Date(studentData.membership_start).toISOString().split('T')[0],
        membership_end: new Date(studentData.membership_end).toISOString().split('T')[0],
        total_fee: parseFloat(studentData.total_fee || 0),
        amount_paid: parseFloat(studentData.amount_paid || 0),
        due_amount: parseFloat(studentData.due_amount || 0),
        cash: parseFloat(studentData.cash || 0),
        online: parseFloat(studentData.online || 0),
        security_money: parseFloat(studentData.security_money || 0),
        discount: parseFloat(studentData.discount || 0),
        remark: studentData.remark || '',
        profile_image_url: studentData.profile_image_url || '',
        aadhaar_front_url: studentData.aadhaar_front_url || '',
        aadhaar_back_url: studentData.aadhaar_back_url || '',
        assignments: assignments.rows,
        lockerFee: parseFloat(studentData.locker_fee || 0),
        lockerNumber: studentData.locker_number || null,
      });
    } catch (err) {
      console.error('Error in students/:id route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.get('/shift/:shiftId', checkAdminOrStaff, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const { search, status: statusFilter } = req.query;
      
      const shiftIdNum = parseInt(shiftId, 10);
      if (isNaN(shiftIdNum)) {
        return res.status(400).json({ message: 'Invalid Shift ID' });
      }

      let query = `
        SELECT
          s.id,
          s.name,
          s.email,
          s.phone,
          s.registration_number,
          s.father_name,
          s.aadhar_number,
          s.profile_image_url,
          s.aadhaar_front_url,
          s.aadhaar_back_url,
          s.membership_end,
          s.discount,
          l.locker_number,
          CASE
            WHEN s.membership_end < CURRENT_DATE THEN 'expired'
            ELSE 'active'
          END AS status
        FROM students s
        JOIN seat_assignments sa ON s.id = sa.student_id
        LEFT JOIN locker l ON s.locker_id = l.id
        WHERE sa.shift_id = $1
      `;
      const params = [shiftIdNum];
      
      let paramIndex = 2;
      if (search) {
        query += ` AND (s.name ILIKE $${paramIndex} OR s.phone ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'active') {
          query += ` AND s.membership_end >= CURRENT_DATE`;
        } else if (statusFilter === 'expired') {
          query += ` AND s.membership_end < CURRENT_DATE`;
        }
      }
      
      query += ` ORDER BY s.name`;

      const result = await pool.query(query, params);
      res.json({ students: result.rows });
    } catch (err) {
      console.error(`Error fetching students for shift ${req.params.shiftId}:`, err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.post('/', checkPermissions(['manage_library_students']), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        name, email, phone, address, branch_id, membership_start, membership_end,
        total_fee, amount_paid, shift_ids, seat_id, cash, online, security_money, remark, profile_image_url,
        registration_number, father_name, aadhar_number, locker_id, aadhaar_front_url, aadhaar_back_url, discount,
        locker_fee
      } = req.body;

      console.log('Received request body for POST /students:', req.body);

      if (!name || !branch_id || !membership_start || !membership_end) {
        console.error('Validation failed: Missing required fields');
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Required fields missing (name, branch_id, membership_start, membership_end)' });
      }

      const branchIdNum = parseInt(branch_id, 10);
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const lockerIdNum = locker_id ? parseInt(locker_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? shift_ids.map(id => parseInt(id, 10)) : [];

      const feeValue = parseFloat(total_fee || 0);
      const paidValue = parseFloat(amount_paid || 0);
      const discountValue = parseFloat(discount || 0);
      const lockerFeeValue = parseFloat(locker_fee || 0);

      if (isNaN(feeValue) || feeValue < 0) {
        console.error('Validation failed: Total fee invalid', { total_fee });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Total fee must be a valid non-negative number' });
      }
      if (isNaN(paidValue) || paidValue < 0) {
        console.error('Validation failed: Amount paid invalid', { amount_paid });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Amount paid must be a valid non-negative number' });
      }
      if (isNaN(discountValue) || discountValue < 0) {
        console.error('Validation failed: Discount invalid', { discount });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Discount must be a valid non-negative number' });
      }

      const cashValue = cash !== undefined ? parseFloat(cash) : 0;
      const onlineValue = online !== undefined ? parseFloat(online) : 0;
      const securityMoneyValue = security_money !== undefined ? parseFloat(security_money) : 0;

      if (isNaN(cashValue) || cashValue < 0) {
        console.error('Validation failed: Cash invalid', { cash });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cash must be a valid non-negative number' });
      }
      if (isNaN(onlineValue) || onlineValue < 0) {
        console.error('Validation failed: Online invalid', { online });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Online payment must be a valid non-negative number' });
      }
      if (isNaN(securityMoneyValue) || securityMoneyValue < 0) {
        console.error('Validation failed: Security money invalid', { security_money });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Security money must be a valid non-negative number' });
      }

      const dueAmount = feeValue - discountValue - paidValue;

      // Validate shifts exist
      if (shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          const shiftCheck = await client.query('SELECT 1 FROM schedules WHERE id = $1', [shiftId]);
          if (shiftCheck.rows.length === 0) {
            console.error('Validation failed: Shift does not exist', { shiftId });
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Shift with ID ${shiftId} does not exist` });
          }
        }
      }

      // Validate seat and check for conflicts only if seat is selected
      if (seatIdNum && shiftIdsNum.length > 0) {
        const seatCheck = await client.query('SELECT 1 FROM seats WHERE id = $1', [seatIdNum]);
        if (seatCheck.rows.length === 0) {
          console.error('Validation failed: Seat does not exist', { seatIdNum });
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Seat with ID ${seatIdNum} does not exist` });
        }

        for (const shiftId of shiftIdsNum) {
          const checkAssignment = await client.query(
            'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2',
            [seatIdNum, shiftId]
          );
          if (checkAssignment.rows.length > 0) {
            console.error('Validation failed: Seat already assigned for shift', { seatIdNum, shiftId });
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Seat is already assigned for shift ${shiftId}` });
          }
        }
      }

      if (lockerIdNum) {
        const lockerCheck = await client.query('SELECT is_assigned FROM locker WHERE id = $1', [lockerIdNum]);
        if (lockerCheck.rows.length === 0) {
          console.error('Validation failed: locker does not exist', { lockerIdNum });
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `locker with ID ${lockerIdNum} does not exist` });
        }
        if (lockerCheck.rows[0].is_assigned) {
          console.error('Validation failed: locker already assigned', { lockerIdNum });
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `locker with ID ${lockerIdNum} is already assigned` });
        }
      }

      const status = new Date(membership_end) < new Date() ? 'expired' : 'active';

      const result = await client.query(
        `INSERT INTO students (
          name, email, phone, address, branch_id, membership_start, membership_end,
          total_fee, amount_paid, due_amount, cash, online, security_money, remark, 
          profile_image_url, aadhaar_front_url, aadhaar_back_url, status, locker_id,
          registration_number, father_name, aadhar_number, discount, is_active, locker_fee, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW()
        ) RETURNING *`,
        [
          name, email, phone, address, branchIdNum, membership_start, membership_end,
          feeValue, paidValue, dueAmount, cashValue, onlineValue, securityMoneyValue, remark || null, 
          profile_image_url || null, aadhaar_front_url || null, aadhaar_back_url || null, status, lockerIdNum,
          registration_number || null, father_name || null, aadhar_number || null, discountValue, true,
          lockerFeeValue
        ]
      );
      const student = result.rows[0];

      if (lockerIdNum) {
        await client.query(
          'UPDATE locker SET is_assigned = true, student_id = $1 WHERE id = $2',
          [student.id, lockerIdNum]
        );
      }

      let firstShiftId = null;
      if (shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, student.id]
          );
          if (!firstShiftId) firstShiftId = shiftId;
        }
      }

      await client.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, shift_id, branch_id,
          registration_number, father_name, aadhar_number,
          profile_image_url, aadhaar_front_url, aadhaar_back_url,
          locker_id, discount, locker_fee, changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())`,
        [
          student.id, student.name, student.email, student.phone, student.address,
          student.membership_start, student.membership_end, student.status,
          student.total_fee, student.amount_paid, student.due_amount,
          student.cash, student.online, student.security_money, student.remark || '',
          seatIdNum, firstShiftId, branchIdNum,
          student.registration_number, student.father_name, student.aadhar_number,
          student.profile_image_url || '', student.aadhaar_front_url || '', student.aadhaar_back_url || '',
          lockerIdNum, student.discount,
          lockerFeeValue
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        student: {
          ...student,
          total_fee: parseFloat(student.total_fee || 0),
          amount_paid: parseFloat(student.amount_paid || 0),
          due_amount: parseFloat(student.due_amount || 0),
          cash: parseFloat(student.cash || 0),
          online: parseFloat(student.online || 0),
          security_money: parseFloat(student.security_money || 0),
          discount: parseFloat(student.discount || 0),
          remark: student.remark || '',
          profile_image_url: student.profile_image_url || '',
          aadhaar_front_url: student.aadhaar_front_url || '',
          aadhaar_back_url: student.aadhaar_back_url || '',
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error adding student:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  router.put('/:id', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = parseInt(req.params.id, 10);
      
      const {
        name, email, phone, address, branch_id, membership_start, membership_end,
        total_fee, amount_paid, shift_ids, seat_id, cash, online, security_money, remark,
        registration_number, father_name, aadhar_number, profile_image_url, locker_id,
        aadhaar_front_url, aadhaar_back_url, discount,
        locker_fee
      } = req.body;
      
      if (!name || !phone || !address || !branch_id || !membership_start || !membership_end) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Required fields missing: Name, Phone, Address, Branch, and Membership Dates are required.' });
      }

      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const lockerIdNum = locker_id ? parseInt(locker_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? shift_ids.map(sid => parseInt(sid, 10)) : [];
      
      const feeValue = parseFloat(total_fee || 0);
      const paidValue = parseFloat(amount_paid || 0);
      const discountValue = parseFloat(discount || 0);
      const lockerFeeValue = parseFloat(locker_fee || 0);
      const dueAmountValue = feeValue - discountValue - paidValue;
      const status = new Date(membership_end) < new Date() ? 'expired' : 'active';

      if (lockerIdNum) {
        const lockerCheck = await client.query('SELECT is_assigned, student_id FROM locker WHERE id = $1', [lockerIdNum]);
        if (lockerCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `locker with ID ${lockerIdNum} does not exist` });
        }
        if (lockerCheck.rows[0].is_assigned && lockerCheck.rows[0].student_id != id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `locker with ID ${lockerIdNum} is already assigned to another student` });
        }
      }

      const previouslockerCheck = await client.query('SELECT locker_id FROM students WHERE id = $1', [id]);
      const previouslockerId = previouslockerCheck.rows[0].locker_id;
      if (previouslockerId) {
        await client.query('UPDATE locker SET is_assigned = false, student_id = NULL WHERE id = $1', [previouslockerId]);
      }

      const result = await client.query(
        `UPDATE students 
         SET name = $1, email = $2, phone = $3, address = $4, branch_id = $5,
             membership_start = $6, membership_end = $7, total_fee = $8, 
             amount_paid = $9, due_amount = $10, cash = $11, online = $12, 
             security_money = $13, remark = $14, status = $15,
             registration_number = $16, father_name = $17, aadhar_number = $18, 
             profile_image_url = $19, locker_id = $20, aadhaar_front_url = $21, aadhaar_back_url = $22, discount = $23,
             locker_fee = $25
         WHERE id = $24
         RETURNING *`,
        [
          name, email, phone, address, branch_id, membership_start, membership_end,
          feeValue, paidValue, dueAmountValue, cash, online,
          security_money, remark || null, status, 
          registration_number || null, father_name || null, aadhar_number || null, 
          profile_image_url || null, lockerIdNum, aadhaar_front_url || null, aadhaar_back_url || null, discountValue,
          id,
          lockerFeeValue
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }
      
      const updatedStudent = result.rows[0];
      
      if (lockerIdNum) {
        await client.query(
          'UPDATE locker SET is_assigned = true, student_id = $1 WHERE id = $2',
          [id, lockerIdNum]
        );
      }

      let firstShiftId = null;
      await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      if (shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, id]
          );
          if (!firstShiftId) firstShiftId = shiftId;
        }
      }
      
      await client.query(
        `UPDATE student_membership_history
         SET name = $1, email = $2, phone = $3, address = $4, membership_start = $5, membership_end = $6, status = $7,
             total_fee = $8, amount_paid = $9, due_amount = $10, cash = $11, online = $12, security_money = $13,
             remark = $14, seat_id = $15, shift_id = $16, branch_id = $17, registration_number = $18,
             father_name = $19, aadhar_number = $20, profile_image_url = $21, 
             aadhaar_front_url = $22, aadhaar_back_url = $23, locker_id = $24, discount = $25, locker_fee = $27, changed_at = NOW()
         WHERE id = (SELECT id FROM student_membership_history WHERE student_id = $26 ORDER BY id DESC LIMIT 1)`,
         [
           updatedStudent.name, updatedStudent.email, updatedStudent.phone, updatedStudent.address,
           updatedStudent.membership_start, updatedStudent.membership_end, updatedStudent.status,
           updatedStudent.total_fee, updatedStudent.amount_paid, updatedStudent.due_amount,
           updatedStudent.cash, updatedStudent.online, updatedStudent.security_money, updatedStudent.remark || '',
           seatIdNum, firstShiftId, updatedStudent.branch_id, updatedStudent.registration_number,
           updatedStudent.father_name, updatedStudent.aadhar_number, updatedStudent.profile_image_url || '',
           updatedStudent.aadhaar_front_url || '', updatedStudent.aadhaar_back_url || '', lockerIdNum, updatedStudent.discount,
           id,
           lockerFeeValue
         ]
      );
      
      await client.query('COMMIT');
      res.json({ student: {
        ...updatedStudent,
        total_fee: parseFloat(updatedStudent.total_fee || 0),
        amount_paid: parseFloat(updatedStudent.amount_paid || 0),
        due_amount: parseFloat(updatedStudent.due_amount || 0),
        cash: parseFloat(updatedStudent.cash || 0),
        online: parseFloat(updatedStudent.online || 0),
        security_money: parseFloat(updatedStudent.security_money || 0),
        discount: parseFloat(updatedStudent.discount || 0),
        remark: updatedStudent.remark || '',
        profile_image_url: updatedStudent.profile_image_url || '',
        aadhaar_front_url: updatedStudent.aadhaar_front_url || '',
        aadhaar_back_url: updatedStudent.aadhaar_back_url || '',
      } });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating student:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await pool.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      await pool.query('UPDATE locker SET is_assigned = false, student_id = NULL WHERE student_id = $1', [id]);
      await pool.query('DELETE FROM student_membership_history WHERE student_id = $1', [id]);
      const del = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
      if (!del.rows[0]) {
        return res.status(404).json({ message: 'Student not found' });
      }
      return res.json({ message: 'Student deleted', student: del.rows[0] });
    } catch (err) {
      console.error('DELETE /students/:id error:', err);
      return res.status(500).json({ message: 'Server error deleting student', error: err.message });
    }
  });

  router.get('/stats/dashboard', checkAdmin, async (req, res) => {
    try {
        const { branchId } = req.query;
        const branchIdNum = branchId ? parseInt(branchId, 10) : null;
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        let params = [startOfMonth, endOfMonth];
        
        let totalCollectionQuery = `SELECT COALESCE(SUM(h.amount_paid), 0) AS total FROM student_membership_history h WHERE h.changed_at BETWEEN $1 AND $2`;
        let totalDueQuery = `SELECT COALESCE(SUM(h.due_amount), 0) AS total FROM student_membership_history h WHERE h.changed_at BETWEEN $1 AND $2`;
        let totalExpenseQuery = `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e WHERE e.date BETWEEN $1 AND $2`;

        if (branchIdNum) {
            totalCollectionQuery += ` AND h.branch_id = $3`;
            totalDueQuery += ` AND h.branch_id = $3`;
            totalExpenseQuery += ` AND e.branch_id = $3`;
            params.push(branchIdNum);
        }

        const totalCollectionResult = await pool.query(totalCollectionQuery, params);
        const totalDueResult = await pool.query(totalDueQuery, params);
        const totalExpenseResult = await pool.query(totalExpenseQuery, params);

        const totalCollection = parseFloat(totalCollectionResult.rows[0].total);
        const totalExpense = parseFloat(totalExpenseResult.rows[0].total);
        const profitLoss = totalCollection - totalExpense;

        res.json({
            totalCollection: totalCollection,
            totalDue: parseFloat(totalDueResult.rows[0].total),
            totalExpense: totalExpense,
            profitLoss: profitLoss
        });
    } catch (err) {
        console.error('Error in students/stats/dashboard route:', err.stack);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.post('/:id/renew', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = parseInt(req.params.id, 10);

      const {
        name, registration_number, father_name, aadhar_number, address,
        membership_start, membership_end, email, phone, branch_id,
        shift_ids, seat_id, total_fee, cash, online, security_money, remark,
        profile_image_url, aadhaar_front_url, aadhaar_back_url, locker_id, discount,
        locker_fee
      } = req.body;

      if (!membership_start || !membership_end || !name || !phone || !branch_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Required fields are missing' });
      }

      const branchIdNum = parseInt(branch_id, 10);
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const lockerIdNum = locker_id ? parseInt(locker_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? shift_ids.map(sId => parseInt(sId, 10)) : [];

      const feeValue = parseFloat(total_fee || 0);
      const cashValue = parseFloat(cash || 0);
      const onlineValue = parseFloat(online || 0);
      const securityMoneyValue = parseFloat(security_money || 0);
      const discountValue = parseFloat(discount || 0);
      const lockerFeeValue = parseFloat(locker_fee || 0);
      const amount_paid = cashValue + onlineValue;
      const due_amount = feeValue - discountValue - amount_paid;
      const status = new Date(membership_end) < new Date() ? 'expired' : 'active';

      if (seatIdNum && shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          const checkAssignment = await client.query(
            'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2 AND student_id != $3',
            [seatIdNum, shiftId, id]
          );
          if (checkAssignment.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Seat is already assigned for shift ${shiftId}` });
          }
        }
      }

      if (lockerIdNum) {
        const lockerCheck = await client.query('SELECT is_assigned, student_id FROM locker WHERE id = $1', [lockerIdNum]);
        if (lockerCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `locker with ID ${lockerIdNum} does not exist` });
        }
        if (lockerCheck.rows[0].is_assigned && lockerCheck.rows[0].student_id != id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `locker with ID ${lockerIdNum} is already assigned to another student` });
        }
      }

      await client.query('UPDATE locker SET is_assigned = false, student_id = NULL WHERE student_id = $1', [id]);

      const upd = await client.query(
        `UPDATE students
         SET name = $1, registration_number = $2, father_name = $3, aadhar_number = $4, address = $5,
             membership_start = $6, membership_end = $7, status = $8,
             email = $9, phone = $10, branch_id = $11,
             total_fee = $12, amount_paid = $13, due_amount = $14,
             cash = $15, online = $16, security_money = $17, remark = $18,
             profile_image_url = $19, aadhaar_front_url = $20, aadhaar_back_url = $21, locker_id = $22, discount = $23,
             locker_fee = $25
         WHERE id = $24
         RETURNING *`,
        [
          name, registration_number, father_name, aadhar_number, address,
          membership_start, membership_end, status,
          email, phone, branchIdNum,
          feeValue, amount_paid, due_amount,
          cashValue, onlineValue, securityMoneyValue, remark || null,
          profile_image_url || null, aadhaar_front_url || null, aadhaar_back_url || null, lockerIdNum, discountValue,
          id,
          lockerFeeValue
        ]
      );

      if (upd.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }
      const updated = upd.rows[0];

      if (lockerIdNum) {
        await client.query(
          'UPDATE locker SET is_assigned = true, student_id = $1 WHERE id = $2',
          [id, lockerIdNum]
        );
      }

      let firstShiftId = null;
      await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      if (shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, id]
          );
          if (!firstShiftId) firstShiftId = shiftId;
        }
      }

      await client.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, shift_id, branch_id,
          registration_number, father_name, aadhar_number,
          profile_image_url, aadhaar_front_url, aadhaar_back_url,
          locker_id, discount, locker_fee, changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())`,
        [
          updated.id, updated.name, updated.email, updated.phone, updated.address,
          updated.membership_start, updated.membership_end, updated.status,
          updated.total_fee, updated.amount_paid, updated.due_amount,
          updated.cash, updated.online, updated.security_money, updated.remark || '',
          seatIdNum, firstShiftId, branchIdNum,
          updated.registration_number, updated.father_name, updated.aadhar_number,
          updated.profile_image_url || '', updated.aadhaar_front_url || '', updated.aadhaar_back_url || '',
          lockerIdNum, updated.discount,
          lockerFeeValue
        ]
      );

      await client.query('COMMIT');
      res.json({
        message: 'Membership renewed',
        student: {
          ...updated,
          total_fee: parseFloat(updated.total_fee || 0),
          amount_paid: parseFloat(updated.amount_paid || 0),
          due_amount: parseFloat(updated.due_amount || 0),
          cash: parseFloat(updated.cash || 0),
          online: parseFloat(updated.online || 0),
          security_money: parseFloat(updated.security_money || 0),
          discount: parseFloat(updated.discount || 0),
          remark: updated.remark || '',
          profile_image_url: updated.profile_image_url || '',
          aadhaar_front_url: updated.aadhaar_front_url || '',
          aadhaar_back_url: updated.aadhaar_back_url || '',
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error in students/:id/renew route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};